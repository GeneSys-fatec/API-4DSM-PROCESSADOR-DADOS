import { SensorLeitura } from "./types";

export function normalizarLeitura(leitura: SensorLeitura, tipo: string): SensorLeitura {
  return { ...leitura };
}
