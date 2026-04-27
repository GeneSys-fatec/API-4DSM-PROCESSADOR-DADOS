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

export type LeituraTratada = SensorLeitura & {
  _id?: any;
  processamento: {
    timestamp: Date;
    status: "válido" | "inválido";
    regras_aplicadas: string[];
    interpolacoes: string[];
  };
};

export interface LeituraRejeitada {
  leitura_original: SensorLeitura;
  motivo: string;
  timestamp: Date;
}

// Request Body Schema para POST /processar
export type EstrategiaValoresNulos = "ignorar" | "interpolar" | "registrar_nulo";

export interface ProcessarLeituraRequest {
  // Filtros de seleção
  tipos_sensores?: ("pluviometro" | "qualidade_ar" | "solo")[];
  uids?: string[];
  data_inicio?: number; // timestamp unix
  data_fim?: number; // timestamp unix
  
  // Configurações de processamento
  estrategia_valores_nulos?: EstrategiaValoresNulos; // default: "registrar_nulo"
  normalizar_unidades?: boolean; // default: true
  limite_leituras?: number; // default: 100
  
  // Flags
  reprocessar_invalidas?: boolean; // default: false - reprocessa leituras anteriormente rejeitadas
}

export interface ProcessarLeituraResponse {
  sucesso: boolean;
  mensagem: string;
  estatisticas: {
    total_processadas: number;
    total_validas: number;
    total_rejeitadas: number;
    total_interpoladas: number;
    tempo_ms: number;
  };
  erros?: string[];
}
