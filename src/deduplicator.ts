import { SensorLeitura } from "./types";

const seenKeys = new Set<string>();

export function isDuplicata(leitura: SensorLeitura): boolean {
  const chave = `${leitura.uid}_${leitura.unixtime}`;
  if (seenKeys.has(chave)) {
    return true;
  }
  seenKeys.add(chave);
  return false;
}

export function clearCache(): void {
  seenKeys.clear();
}
