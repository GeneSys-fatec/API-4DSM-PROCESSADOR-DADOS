import { Collection } from "mongodb";
import { validarRange, getTipo } from "./validators";
import { isDuplicata } from "./deduplicator";
import { normalizarLeitura } from "./normalizer";
import { salvarMedicao, salvarRejeicao } from "./db";
import { SensorLeitura, LeituraTratada, LeituraRejeitada } from "./types";

export async function processarLeituras(colecaoRaw: Collection) {
  const leituras = await colecaoRaw
    .find({ _processada: { $ne: true } })
    .limit(100)
    .toArray();

  console.log(`Processando ${leituras.length} leituras...`);

  for (const doc of leituras) {
    const leitura = doc as any as SensorLeitura;

    try {
      if (isDuplicata(leitura)) {
        await salvarRejeicao({
          leitura_original: leitura,
          motivo: "Duplicata detectada",
          timestamp: new Date()
        });
        continue;
      }

      const tipo = getTipo(leitura.uid);
      const { valido, erros } = validarRange(leitura, tipo);

      if (!valido) {
        await salvarRejeicao({
          leitura_original: leitura,
          motivo: erros.join("; "),
          timestamp: new Date()
        });
        continue;
      }

      const normalizada = normalizarLeitura(leitura, tipo);

      const tratada: LeituraTratada = {
        ...normalizada,
        processamento: {
          timestamp: new Date(),
          status: "válido",
          regras_aplicadas: ["deduplicacao", "validacao_range", "normalizacao"],
          interpolacoes: []
        }
      };

      await salvarMedicao(tratada);
      console.log(`Medição ${leitura.uid} processada`);
    } catch (erro) {
      console.error(`Erro processando ${leitura.uid}:`, erro);
      await salvarRejeicao({
        leitura_original: leitura,
        motivo: String(erro),
        timestamp: new Date()
      });
    }

    await colecaoRaw.updateOne({ _id: doc._id }, { $set: { _processada: true } });
  }

  console.log("Processamento concluído!");
}
