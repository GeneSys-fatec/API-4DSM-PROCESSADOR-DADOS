import { SensorLeitura } from "./types";
import { Collection } from "mongodb";

// Cache em memória para duplicatas na sessão atual
const seenKeys = new Set<string>();

/**
 * Verifica se uma leitura é duplicata
 * Usa cache em memória na sessão + consulta Mongo para persistência
 */
export function isDuplicata(leitura: SensorLeitura, colecaoDuplicatas?: Collection): boolean {
  const chave = gerarChaveDuplicata(leitura);
  
  // Verifica cache em memória primeiro (mais rápido)
  if (seenKeys.has(chave)) {
    return true;
  }
  
  seenKeys.add(chave);
  return false;
}

/**
 * Verifica duplicata de forma assíncrona com persistência no Mongo
 */
export async function isDuplicataAsync(
  leitura: SensorLeitura,
  colecaoDuplicatas: Collection
): Promise<boolean> {
  const chave = gerarChaveDuplicata(leitura);
  
  // Verifica cache em memória primeiro
  if (seenKeys.has(chave)) {
    return true;
  }
  
  // Verifica no Mongo
  const existe = await colecaoDuplicatas.findOne({ chave });
  if (existe) {
    return true;
  }
  
  // Adiciona ao cache e ao Mongo
  seenKeys.add(chave);
  await colecaoDuplicatas.insertOne({
    chave,
    uid: leitura.uid,
    unixtime: leitura.unixtime,
    timestamp_deteccao: new Date()
  });
  
  return false;
}

/**
 * Gera chave única para detectar duplicatas: uid + timestamp
 */
function gerarChaveDuplicata(leitura: SensorLeitura): string {
  return `${leitura.uid}_${leitura.unixtime}`;
}

/**
 * Limpa cache de duplicatas em memória
 */
export function clearCache(): void {
  seenKeys.clear();
}

/**
 * Limpa histórico de duplicatas do Mongo
 * Mantém apenas últimos N dias
 */
export async function limparHistoricoDuplicatas(
  colecaoDuplicatas: Collection,
  diasRetensao: number = 30
): Promise<number> {
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - diasRetensao);
  
  const resultado = await colecaoDuplicatas.deleteMany({
    timestamp_deteccao: { $lt: dataLimite }
  });
  
  return resultado.deletedCount || 0;
}

/**
 * Retorna estatísticas de duplicatas detectadas
 */
export async function estatisticasDuplicatas(
  colecaoDuplicatas: Collection
): Promise<{
  total_em_cache: number;
  total_persistido: number;
}> {
  return {
    total_em_cache: seenKeys.size,
    total_persistido: await colecaoDuplicatas.countDocuments()
  };
}
