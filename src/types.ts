// types.ts

export interface SensorPluviometro {
  uid: string;
  unixtime: number;
  chuva_mm: number;
  umidade: number;
  temperatura: number;
}

export interface SensorQualidadeAr {
  uid: string;
  unixtime: number;
  co2: number;
  pm25: number;
  qualidade_index: number;
}

export interface SensorSolo {
  uid: string;
  unixtime: number;
  umidade_solo: number;
  ph: number;
  temp_solo: number;
}

export type SensorLeitura = SensorPluviometro | SensorQualidadeAr | SensorSolo;

export interface LeituraTratada extends SensorLeitura {
  _id?: any;
  processamento: {
    timestamp: Date;
    status: "válido" | "inválido";
    regras_aplicadas: string[];
    interpolacoes: string[];
  };
}

export interface LeituraRejeitada {
  leitura_original: SensorLeitura;
  motivo: string;
  timestamp: Date;
}
