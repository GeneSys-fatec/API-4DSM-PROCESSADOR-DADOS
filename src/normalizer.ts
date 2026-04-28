import { SensorLeitura, SensorPluviometro, SensorQualidadeAr, SensorSolo } from "./types";


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

function normalizarPluviometro(leitura: SensorPluviometro): SensorPluviometro {
  return {
    ...leitura,
    chuva_mm: Math.abs(leitura.chuva_mm),
    umidade: Math.max(0, Math.min(100, leitura.umidade)),
    temperatura: leitura.temperatura
  };
}

function normalizarQualidadeAr(leitura: SensorQualidadeAr): SensorQualidadeAr {
  return {
    ...leitura,
    co2: Math.max(200, Math.min(5000, leitura.co2)),
    pm25: Math.max(0, leitura.pm25),
    qualidade_index: Math.max(1, Math.min(5, Math.round(leitura.qualidade_index)))
  };
}


function normalizarSolo(leitura: SensorSolo): SensorSolo {
  return {
    ...leitura,
    umidade_solo: Math.max(0, Math.min(100, leitura.umidade_solo)),
    ph: Math.max(3, Math.min(10, leitura.ph)),
    temp_solo: leitura.temp_solo
  };
}

export function interpolarValor(
  valores: (number | null | undefined)[]
): number | null {
  const valoresValidos = valores.filter(v => v !== null && v !== undefined && !isNaN(v as number)) as number[];
  
  if (valoresValidos.length === 0) return null;
  
  const soma = valoresValidos.reduce((a, b) => a + b, 0);
  return Math.round((soma / valoresValidos.length) * 100) / 100;
}

