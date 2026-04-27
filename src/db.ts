import "reflect-metadata";
import { MongoClient, Db, Collection } from "mongodb";
import { DataSource } from "typeorm";
import { Measurement } from "./entities/Measurement";
import { AlertLog } from "./entities/AlertLog";
import { LeituraTratada, LeituraRejeitada } from "./types";

let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  username: process.env.DB_USERNAME || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "api4dsm",
  entities: [Measurement, AlertLog],
  synchronize: true,
  logging: false,
});

export async function conectarMongoDB(mongoUri: string): Promise<void> {
  mongoClient = new MongoClient(mongoUri, {
    tls: true,
    tlsAllowInvalidCertificates: true,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 30000,
    retryWrites: true,
  });
  await mongoClient.connect();
  mongoDb = mongoClient.db("sensor_data");
  console.log("[DB] MongoDB conectado");
}

export function getColecaoRaw(): Collection {
  if (!mongoDb) throw new Error("MongoDB não conectado");
  return mongoDb.collection("leituras");
}

export function getColecaoDuplicatas(): Collection {
  if (!mongoDb) throw new Error("MongoDB não conectado");
  return mongoDb.collection("duplicatas_detectadas");
}

export function getColecaoRejeitadas(): Collection {
  if (!mongoDb) throw new Error("MongoDB não conectado");
  return mongoDb.collection("leituras_rejeitadas");
}

export async function desconectarMongoDB(): Promise<void> {
  if (mongoClient) {
    await mongoClient.close();
    console.log("[DB] MongoDB desconectado");
  }
}

export async function salvarMedicao(leitura: LeituraTratada): Promise<void> {
  const leituraData = leitura as any;
  const tipo = getTipo(leituraData.uid);
  const measurements: Measurement[] = [];

  // Mapear cada campo do sensor para um parâmetro PostgreSQL
  if (tipo === "pluviometro") {
    if (leituraData.chuva_mm !== null && leituraData.chuva_mm !== undefined) {
      const m = new Measurement();
      m.id_parameter = 1; // Chuva
      m.raw_value = leituraData.chuva_mm;
      m.decimal_2_4 = leituraData.chuva_mm;
      m.timestamp = new Date(leituraData.unixtime);
      measurements.push(m);
    }
    if (leituraData.umidade !== null && leituraData.umidade !== undefined) {
      const m = new Measurement();
      m.id_parameter = 2; // Umidade
      m.raw_value = leituraData.umidade;
      m.decimal_2_4 = leituraData.umidade;
      m.timestamp = new Date(leituraData.unixtime);
      measurements.push(m);
    }
    if (leituraData.temperatura !== null && leituraData.temperatura !== undefined) {
      const m = new Measurement();
      m.id_parameter = 9; // Temperatura
      m.raw_value = leituraData.temperatura;
      m.decimal_2_4 = leituraData.temperatura;
      m.timestamp = new Date(leituraData.unixtime);
      measurements.push(m);
    }
  } else if (tipo === "qualidade_ar") {
    if (leituraData.co2 !== null && leituraData.co2 !== undefined) {
      const m = new Measurement();
      m.id_parameter = 3; // CO2
      m.raw_value = leituraData.co2;
      m.decimal_2_4 = leituraData.co2;
      m.timestamp = new Date(leituraData.unixtime);
      measurements.push(m);
    }
    if (leituraData.pm25 !== null && leituraData.pm25 !== undefined) {
      const m = new Measurement();
      m.id_parameter = 4; // PM2.5
      m.raw_value = leituraData.pm25;
      m.decimal_2_4 = leituraData.pm25;
      m.timestamp = new Date(leituraData.unixtime);
      measurements.push(m);
    }
    if (leituraData.qualidade_index !== null && leituraData.qualidade_index !== undefined) {
      const m = new Measurement();
      m.id_parameter = 5; // Qualidade Index
      m.raw_value = leituraData.qualidade_index;
      m.decimal_2_4 = leituraData.qualidade_index;
      m.timestamp = new Date(leituraData.unixtime);
      measurements.push(m);
    }
  } else if (tipo === "solo") {
    if (leituraData.umidade_solo !== null && leituraData.umidade_solo !== undefined) {
      const m = new Measurement();
      m.id_parameter = 6; // Umidade Solo
      m.raw_value = leituraData.umidade_solo;
      m.decimal_2_4 = leituraData.umidade_solo;
      m.timestamp = new Date(leituraData.unixtime);
      measurements.push(m);
    }
    if (leituraData.ph !== null && leituraData.ph !== undefined) {
      const m = new Measurement();
      m.id_parameter = 7; // pH
      m.raw_value = leituraData.ph;
      m.decimal_2_4 = leituraData.ph;
      m.timestamp = new Date(leituraData.unixtime);
      measurements.push(m);
    }
    if (leituraData.temp_solo !== null && leituraData.temp_solo !== undefined) {
      const m = new Measurement();
      m.id_parameter = 8; // Temperatura Solo
      m.raw_value = leituraData.temp_solo;
      m.decimal_2_4 = leituraData.temp_solo;
      m.timestamp = new Date(leituraData.unixtime);
      measurements.push(m);
    }
  }

  if (measurements.length > 0) {
    await AppDataSource.getRepository(Measurement).save(measurements);
  }
}

function getTipo(uid: string): string {
  if (uid.includes("PLUVIOMETRO")) return "pluviometro";
  if (uid.includes("QUALIDADE_AR")) return "qualidade_ar";
  if (uid.includes("SOLO")) return "solo";
  return "desconhecido";
}

export async function salvarRejeicao(rejeicao: LeituraRejeitada): Promise<void> {
  const leituraData = rejeicao.leitura_original as any;

  // 1. Salvar em PostgreSQL para exibição de alertas
  const alertLog = new AlertLog();
  alertLog.id_start_rule = 0;
  alertLog.login = "system";
  alertLog.text = rejeicao.motivo;
  alertLog.triggered_value = JSON.stringify(leituraData);
  alertLog.triggered_at = new Date(leituraData.unixtime);
  alertLog.status = "alert_status_error";

  await AppDataSource.getRepository(AlertLog).save(alertLog);

  // 2. Salvar em MongoDB para auditoria
  const colecaoRejeitadas = getColecaoRejeitadas();
  await colecaoRejeitadas.insertOne({
    ...rejeicao,
    _timestamp_rejeicao: new Date()
  });
}
