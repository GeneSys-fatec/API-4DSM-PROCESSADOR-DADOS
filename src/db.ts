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
  const tipo = leituraData.uid.substring(0, 1);

  let paramId: number = 0;
  let valor: number = 0;

  if (tipo === "P" && leituraData.chuva_mm !== undefined) {
    paramId = 1;
    valor = leituraData.chuva_mm;
  } else if (tipo === "Q" && leituraData.umidade !== undefined) {
    paramId = 2;
    valor = leituraData.umidade;
  } else if (tipo === "S" && leituraData.umidade_solo !== undefined) {
    paramId = 3;
    valor = leituraData.umidade_solo;
  }

  const measurement = new Measurement();
  measurement.id_parameter = paramId;
  measurement.raw_value = valor;
  measurement.decimal_2_4 = valor;
  measurement.timestamp = new Date(leituraData.unixtime);

  await AppDataSource.getRepository(Measurement).save(measurement);
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
