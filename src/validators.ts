import { SensorLeitura } from "./types";

export const RANGES: Record<string, Record<string, { min: number; max: number }>> = {
  pluviometro: {
    chuva_mm: { min: 0, max: 1000 },
    umidade: { min: 0, max: 100 },
    temperatura: { min: -50, max: 60 }
  },
  qualidade_ar: {
    co2: { min: 200, max: 5000 },
    pm25: { min: 0, max: 500 },
    qualidade_index: { min: 1, max: 5 }
  },
  solo: {
    umidade_solo: { min: 0, max: 100 },
    ph: { min: 3, max: 10 },
    temp_solo: { min: -20, max: 60 }
  }
};

export function validarRange(
  leitura: SensorLeitura,
  tipo: string
): { valido: boolean; erros: string[] } {
  const erros: string[] = [];
  const ranges = RANGES[tipo];

  if (!ranges) return { valido: false, erros: ["Tipo de sensor desconhecido"] };

  Object.keys(ranges).forEach((campo) => {
    const valor = (leitura as any)[campo];
    const { min, max } = ranges[campo];

    if (valor === undefined || valor === null) {
      erros.push(`${campo}: valor ausente`);
      return;
    }

    if (valor < min || valor > max) {
      erros.push(`${campo}: ${valor} fora da faixa [${min}, ${max}]`);
    }
  });

  return { valido: erros.length === 0, erros };
}

export function getTipo(uid: string): string {
  if (uid.includes("PLUVIOMETRO")) return "pluviometro";
  if (uid.includes("QUALIDADE_AR")) return "qualidade_ar";
  if (uid.includes("SOLO")) return "solo";
  return "desconhecido";
}
