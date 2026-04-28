import { SensorLeitura } from "./types";
import { Collection } from "mongodb";

const seenKeys = new Set<string>();

export function isDuplicata(leitura: SensorLeitura, colecaoDuplicatas?: Collection): boolean {
  const chave = gerarChaveDuplicata(leitura);
  
  if (seenKeys.has(chave)) {
    return true;
  }
  
  seenKeys.add(chave);
  return false;
}

export async function isDuplicataAsync(
  leitura: SensorLeitura,
  colecaoDuplicatas: Collection
): Promise<boolean> {
  const chave = gerarChaveDuplicata(leitura);
  
  if (seenKeys.has(chave)) {
    return true;
  }
  
  const existe = await colecaoDuplicatas.findOne({ chave });
  if (existe) {
    return true;
  }
  
  seenKeys.add(chave);
  await colecaoDuplicatas.insertOne({
    chave,
    uid: leitura.uid,
    unixtime: leitura.unixtime,
    timestamp_deteccao: new Date()
  });
  
  return false;
}

function gerarChaveDuplicata(leitura: SensorLeitura): string {
  return `${leitura.uid}_${leitura.unixtime}`;
}

export function clearCache(): void {
  seenKeys.clear();
}

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
