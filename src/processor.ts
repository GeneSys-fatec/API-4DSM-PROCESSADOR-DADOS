import { Collection, Document } from "mongodb";
import { validarRange, getTipo } from "./validators";
import { normalizarLeitura, interpolarValor } from "./normalizer";
import { salvarMedicao, getColecaoRaw, verificarDuplicataPostgres } from "./db";
import { SensorLeitura, LeituraTratada, ProcessarLeituraRequest, EstrategiaValoresNulos } from "./types";

export interface ProcessarLeituraOpcoes extends ProcessarLeituraRequest {
  estrategia_valores_nulos: EstrategiaValoresNulos;
  normalizar_unidades: boolean;
  limite_leituras: number;
}

export interface ProcessarLeituraResult {
  total_processadas: number;
  total_validas: number;
  total_rejeitadas: number;
  total_interpoladas: number;
}

export async function processarLeituras(
  colecaoRaw: Collection,
  opcoes: Partial<ProcessarLeituraOpcoes> = {}
): Promise<ProcessarLeituraResult> {
  const inicio = Date.now();
  
  const config: ProcessarLeituraOpcoes = {
    tipos_sensores: opcoes.tipos_sensores,
    uids: opcoes.uids,
    data_inicio: opcoes.data_inicio,
    data_fim: opcoes.data_fim,
    estrategia_valores_nulos: opcoes.estrategia_valores_nulos || "registrar_nulo",
    normalizar_unidades: opcoes.normalizar_unidades !== false,
    limite_leituras: opcoes.limite_leituras || 100,
    reprocessar_invalidas: opcoes.reprocessar_invalidas || false
  };

  let estatisticas: ProcessarLeituraResult = {
    total_processadas: 0,
    total_validas: 0,
    total_rejeitadas: 0,
    total_interpoladas: 0
  };

  try {
    const filtro = construirFiltro(config);

    const leituras = await colecaoRaw
      .find(filtro)
      .limit(config.limite_leituras)
      .toArray();

    console.log(`[PROCESSOR] Processando ${leituras.length} leituras...`);

    for (const doc of leituras) {
      const leitura = doc as any as SensorLeitura;
      estatisticas.total_processadas++;

      try {
        const tipo = getTipo(leitura.uid);
        if (tipo === "desconhecido") {
          throw new Error("Tipo de sensor desconhecido");
        }

        console.log(`[PROCESSOR] Processando ${leitura.uid} (tipo: ${tipo}):`, JSON.stringify(leitura).substring(0, 150));

        const leituraComTratamento = tratarValoresNulos(leitura, tipo, config.estrategia_valores_nulos);
        if (!leituraComTratamento) {
          console.log(`[PROCESSOR] ${leitura.uid} - Rejeitada por valores nulos`);
          estatisticas.total_rejeitadas++;
          continue;
        }

        let interpolacoes: string[] = [];
        if (config.estrategia_valores_nulos === "interpolar") {
          const resultado = tentarInterpolacoes(leituraComTratamento, tipo);
          Object.assign(leituraComTratamento, resultado.leitura);
          interpolacoes = resultado.interpolacoes;
          estatisticas.total_interpoladas += interpolacoes.length;
        }

        const { valido, erros } = validarRange(leituraComTratamento, tipo);
        if (!valido) {
          console.log(`[PROCESSOR] ${leitura.uid} rejeitada - Fora de faixa: ${erros.join(", ")}`);
          estatisticas.total_rejeitadas++;
          continue;
        }

        let normalizada = leituraComTratamento;
        if (config.normalizar_unidades) {
          normalizada = normalizarLeitura(leituraComTratamento, tipo);
        }

        const tratada: LeituraTratada = {
          ...normalizada,
          processamento: {
            timestamp: new Date(),
            status: "válido",
            regras_aplicadas: ["validacao_range", "normalizacao"],
            interpolacoes: interpolacoes
          }
        };

        // 7. Verificar se já existe no PostgreSQL (duplicata)
        const isDuplicata = await verificarDuplicataPostgres(tratada);
        if (isDuplicata) {
          console.log(`[PROCESSOR] ${leitura.uid} rejeitada - Já existe no PostgreSQL (duplicata)`);
          estatisticas.total_rejeitadas++;
          continue;
        }

        console.log(`[PROCESSOR] Tentando salvar: ${leitura.uid} com valores:`, { 
          raw_value: (normalizada as any).chuva_mm || (normalizada as any).co2 || (normalizada as any).umidade_solo,
          timestamp: (normalizada as any).unixtime
        });
        await salvarMedicao(tratada);
        estatisticas.total_validas++;
        
        console.log(`[PROCESSOR] ${leitura.uid} processada com sucesso`);
      } catch (erro) {
        console.error(`[PROCESSOR] ${leitura.uid} - Exceção:`, erro instanceof Error ? erro.message : String(erro));
        estatisticas.total_rejeitadas++;
      }

      await colecaoRaw.updateOne({ _id: doc._id }, { $set: { _processada: true } });
    }

    console.log(`[PROCESSOR] Processamento concluído em ${Date.now() - inicio}ms`);
    console.log(`[PROCESSOR] Resumo: ${estatisticas.total_validas} válidas, ${estatisticas.total_rejeitadas} rejeitadas, ${estatisticas.total_interpoladas} interpoladas`);

    return estatisticas;
  } catch (erro) {
    console.error("[PROCESSOR] Erro fatal:", erro);
    throw erro;
  }
}


function construirFiltro(config: ProcessarLeituraOpcoes): Document {
  const filtro: Document = {};

  if (config.tipos_sensores && config.tipos_sensores.length > 0) {
    const uidsPattern = config.tipos_sensores.map(tipo => {
      if (tipo === "pluviometro") return "PLUVIOMETRO";
      if (tipo === "qualidade_ar") return "QUALIDADE_AR";
      if (tipo === "solo") return "SOLO";
      return tipo;
    });
    
    filtro.uid = { $in: uidsPattern.map(p => ({ $regex: p })) };
  }

  if (config.uids && config.uids.length > 0) {
    filtro.uid = { $in: config.uids };
  }

  if (config.data_inicio || config.data_fim) {
    filtro.unixtime = {};
    if (config.data_inicio) filtro.unixtime.$gte = config.data_inicio;
    if (config.data_fim) filtro.unixtime.$lte = config.data_fim;
  }

  return filtro;
}

function tratarValoresNulos(
  leitura: SensorLeitura,
  tipo: string,
  estrategia: EstrategiaValoresNulos
): SensorLeitura | null {
  const leituraData = leitura as any;
  const campos = obterCamposEsperados(tipo);
  const valoresNulos = campos.filter(campo => leituraData[campo] === null || leituraData[campo] === undefined);

  if (valoresNulos.length === 0) {
    return leitura;
  }

  switch (estrategia) {
    case "ignorar":
      console.log(`[PROCESSOR] Leitura ${leitura.uid} tem valores nulos em: ${valoresNulos.join(", ")} - rejeitada`);
      return null;

    case "registrar_nulo":
      return leitura;

    case "interpolar":
      return leitura;

    default:
      return leitura;
  }
}

function tentarInterpolacoes(
  leitura: SensorLeitura,
  tipo: string
): { leitura: Record<string, any>; interpolacoes: string[] } {
  const leituraData = leitura as any;
  const campos = obterCamposEsperados(tipo);
  const interpolacoes: string[] = [];

  for (const campo of campos) {
    if (leituraData[campo] === null || leituraData[campo] === undefined) {
      interpolacoes.push(campo);
    }
  }

  return { leitura, interpolacoes };
}

function obterCamposEsperados(tipo: string): string[] {
  switch (tipo) {
    case "pluviometro":
      return ["chuva_mm", "umidade", "temperatura"];
    case "qualidade_ar":
      return ["co2", "pm25", "qualidade_index"];
    case "solo":
      return ["umidade_solo", "ph", "temp_solo"];
    default:
      return [];
  }
}
