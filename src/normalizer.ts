import { SensorLeitura, SensorPluviometro, SensorQualidadeAr, SensorSolo } from "./types";

/**
 * Normaliza uma leitura de sensor conforme padrões definidos:
 * - Pluviômetro: chuva em mm, umidade %, temperatura em °C
 * - Qualidade do Ar: CO2 em ppm, PM2.5 em µg/m³, índice 1-5
 * - Solo: umidade %, pH, temperatura em °C
 */
export function normalizarLeitura(leitura: SensorLeitura, tipo: string): SensorLeitura {
  switch (tipo) {
    case "pluviometro":
      return normalizarPluviometro(leitura as SensorPluviometro);
    case "qualidade_ar":
      return normalizarQualidadeAr(leitura as SensorQualidadeAr);
    case "solo":
      return normalizarSolo(leitura as SensorSolo);
    default:
      return { ...leitura };
  }
}

/**
 * Normaliza sensor pluviométrico
 * - Garante que chuva está em mm (0-1000)
 * - Garante umidade em % (0-100)
 * - Garante temperatura em °C (-50 a 60)
 */
function normalizarPluviometro(leitura: SensorPluviometro): SensorPluviometro {
  return {
    ...leitura,
    chuva_mm: Math.abs(leitura.chuva_mm), // remove negativos
    umidade: Math.max(0, Math.min(100, leitura.umidade)), // limita 0-100
    temperatura: leitura.temperatura // já em °C
  };
}

/**
 * Normaliza sensor de qualidade do ar
 * - Garante CO2 em ppm (200-5000)
 * - Garante PM2.5 em µg/m³ (0-500)
 * - Garante índice de qualidade 1-5
 */
function normalizarQualidadeAr(leitura: SensorQualidadeAr): SensorQualidadeAr {
  return {
    ...leitura,
    co2: Math.max(200, Math.min(5000, leitura.co2)), // limita faixa normal
    pm25: Math.max(0, leitura.pm25), // remove negativos
    qualidade_index: Math.max(1, Math.min(5, Math.round(leitura.qualidade_index))) // 1-5
  };
}

/**
 * Normaliza sensor de solo
 * - Garante umidade em % (0-100)
 * - Garante pH 3-10
 * - Garante temperatura em °C (-20 a 60)
 */
function normalizarSolo(leitura: SensorSolo): SensorSolo {
  return {
    ...leitura,
    umidade_solo: Math.max(0, Math.min(100, leitura.umidade_solo)), // limita 0-100
    ph: Math.max(3, Math.min(10, leitura.ph)), // limita faixa de pH normal
    temp_solo: leitura.temp_solo // já em °C
  };
}

/**
 * Interpola valor nulo baseado em valores adjacentes
 */
export function interpolarValor(
  valores: (number | null | undefined)[]
): number | null {
  const valoresValidos = valores.filter(v => v !== null && v !== undefined && !isNaN(v as number)) as number[];
  
  if (valoresValidos.length === 0) return null;
  
  const soma = valoresValidos.reduce((a, b) => a + b, 0);
  return Math.round((soma / valoresValidos.length) * 100) / 100; // média arredondada a 2 casas
}

