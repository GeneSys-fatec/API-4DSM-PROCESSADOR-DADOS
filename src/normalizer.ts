// normalizer.ts

import { SensorLeitura } from "./types";

export function normalizarLeitura(leitura: SensorLeitura, tipo: string): SensorLeitura {
  // Aqui você adiciona conversões se necessário
  // Ex: se temperatura vem em Fahrenheit, converter para Celsius
  
  // Por enquanto, retorna igual (já vem normalizado do Python)
  return { ...leitura };
}
