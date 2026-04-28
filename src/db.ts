import "reflect-metadata";
import { MongoClient, Db, Collection } from "mongodb";
import { DataSource } from "typeorm";
import { Measurement } from "./entities/Measurement";
import { AlertLog } from "./entities/AlertLog";
import { LeituraTratada } from "./types";

let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  username: process.env.DB_USERNAME || "postgres",
  password: process.env.DB_PASSWORD || "root",
  database: process.env.DB_NAME || "api4dsm",
  entities: [Measurement, AlertLog],
  synchronize: false,
  logging: false,
});

export async function conectarMongoDB(mongoUri: string): Promise<void> {
  mongoClient = new MongoClient(mongoUri, {
    tls: true,
    tlsInsecure: true,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 30000,
  });
  await mongoClient.connect();
  mongoDb = mongoClient.db("sensor_data");
  console.log("[DB] MongoDB conectado");
}

export function getColecaoRaw(): Collection {
  if (!mongoDb) throw new Error("MongoDB não conectado");
  return mongoDb.collection("leituras");
}

export async function desconectarMongoDB(): Promise<void> {
  if (mongoClient) {
    await mongoClient.close();
    console.log("[DB] MongoDB desconectado");
  }
}

export async function verificarDuplicataPostgres(leitura: LeituraTratada): Promise<boolean> {
  const leituraData = leitura as any;
  const tipo = getTipo(leituraData.uid);
  const timestamp = new Date(leituraData.unixtime * 1000);

  try {
    const repo = AppDataSource.getRepository(Measurement);
    
    let parametersIds: number[] = [];
    if (tipo === "pluviometro") {
      if (leituraData.chuva_mm != null) parametersIds.push(1);
      if (leituraData.umidade != null) parametersIds.push(2);
      if (leituraData.temperatura != null) parametersIds.push(9);
    } else if (tipo === "qualidade_ar") {
      if (leituraData.co2 != null) parametersIds.push(3);
      if (leituraData.pm25 != null) parametersIds.push(4);
      if (leituraData.qualidade_index != null) parametersIds.push(5);
    } else if (tipo === "solo") {
      if (leituraData.umidade_solo != null) parametersIds.push(6);
      if (leituraData.ph != null) parametersIds.push(7);
      if (leituraData.temp_solo != null) parametersIds.push(8);
    }

    if (parametersIds.length === 0) {
      return false;
    }

    let query = repo.createQueryBuilder("m")
      .where("m.collected_at = :timestamp", { timestamp });
    
    if (parametersIds.length > 0) {
      const orConditions = parametersIds
        .map((_, idx) => `m.id_parameter = :param${idx}`)
        .join(" OR ");
      
      query = query.andWhere(`(${orConditions})`);
      
      parametersIds.forEach((paramId, idx) => {
        query = query.setParameter(`param${idx}`, paramId);
      });
    }

    const existente = await query.getOne();
    return !!existente;
  } catch (erro) {
    console.error(`[DB] Erro ao verificar duplicata:`, erro);
    return false;
  }
}

export async function salvarMedicao(leitura: LeituraTratada): Promise<void> {
  const leituraData = leitura as any;
  const tipo = getTipo(leituraData.uid);
  const measurements: Measurement[] = [];

  if (tipo === "pluviometro") {
    if (leituraData.chuva_mm !== null && leituraData.chuva_mm !== undefined) {
      const m = new Measurement();
      m.id_parameter = 1;
      m.raw_value = leituraData.chuva_mm;
      m.value = leituraData.chuva_mm;
      m.collected_at = new Date(leituraData.unixtime * 1000);
      measurements.push(m);
    }
    if (leituraData.umidade !== null && leituraData.umidade !== undefined) {
      const m = new Measurement();
      m.id_parameter = 2;
      m.raw_value = leituraData.umidade;
      m.value = leituraData.umidade;
      m.collected_at = new Date(leituraData.unixtime * 1000);
      measurements.push(m);
    }
    if (leituraData.temperatura !== null && leituraData.temperatura !== undefined) {
      const m = new Measurement();
      m.id_parameter = 9;
      m.raw_value = leituraData.temperatura;
      m.value = leituraData.temperatura;
      m.collected_at = new Date(leituraData.unixtime * 1000);
      measurements.push(m);
    }
  } else if (tipo === "qualidade_ar") {
    if (leituraData.co2 !== null && leituraData.co2 !== undefined) {
      const m = new Measurement();
      m.id_parameter = 3;
      m.raw_value = leituraData.co2;
      m.value = leituraData.co2;
      m.collected_at = new Date(leituraData.unixtime * 1000);
      measurements.push(m);
    }
    if (leituraData.pm25 !== null && leituraData.pm25 !== undefined) {
      const m = new Measurement();
      m.id_parameter = 4;
      m.raw_value = leituraData.pm25;
      m.value = leituraData.pm25;
      m.collected_at = new Date(leituraData.unixtime * 1000);
      measurements.push(m);
    }
    if (leituraData.qualidade_index !== null && leituraData.qualidade_index !== undefined) {
      const m = new Measurement();
      m.id_parameter = 5;
      m.raw_value = leituraData.qualidade_index;
      m.value = leituraData.qualidade_index;
      m.collected_at = new Date(leituraData.unixtime * 1000);
      measurements.push(m);
    }
  } else if (tipo === "solo") {
    if (leituraData.umidade_solo !== null && leituraData.umidade_solo !== undefined) {
      const m = new Measurement();
      m.id_parameter = 6;
      m.raw_value = leituraData.umidade_solo;
      m.value = leituraData.umidade_solo;
      m.collected_at = new Date(leituraData.unixtime * 1000);
      measurements.push(m);
    }
    if (leituraData.ph !== null && leituraData.ph !== undefined) {
      const m = new Measurement();
      m.id_parameter = 7;
      m.raw_value = leituraData.ph;
      m.value = leituraData.ph;
      m.collected_at = new Date(leituraData.unixtime * 1000);
      measurements.push(m);
    }
    if (leituraData.temp_solo !== null && leituraData.temp_solo !== undefined) {
      const m = new Measurement();
      m.id_parameter = 8;
      m.raw_value = leituraData.temp_solo;
      m.value = leituraData.temp_solo;
      m.collected_at = new Date(leituraData.unixtime * 1000);
      measurements.push(m);
    }
  }

  if (measurements.length > 0) {
    try {
      console.log(`[DB] Salvando ${measurements.length} measurement(s) para ${leituraData.uid}`);
      await AppDataSource.getRepository(Measurement).save(measurements);
      console.log(`[DB] Salvo com sucesso`);
    } catch (erro) {
      console.error(`[DB] Erro ao salvar measurements:`, erro);
      throw erro;
    }
  } else {
    console.log(`[DB] Nenhum measurement para salvar de ${leituraData.uid}`);
  }
}

function getTipo(uid: string): string {
  if (uid.includes("PLUVIOMETRO")) return "pluviometro";
  if (uid.includes("QUALIDADE_AR")) return "qualidade_ar";
  if (uid.includes("SOLO")) return "solo";
  return "desconhecido";
}


