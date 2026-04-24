// db.ts

import { MongoClient, Db, Collection } from "mongodb";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function conectarMongoDB(mongoUri: string): Promise<void> {
  client = new MongoClient(mongoUri);
  await client.connect();
  db = client.db("sensor_data");
  console.log("✓ Conectado ao MongoDB");
}

export function getColecaoRaw(): Collection {
  if (!db) throw new Error("Banco de dados não conectado");
  return db.collection("leituras");
}

export function getColecaoTratada(): Collection {
  if (!db) throw new Error("Banco de dados não conectado");
  return db.collection("leituras_tratadas");
}

export function getColecaoRejeitada(): Collection {
  if (!db) throw new Error("Banco de dados não conectado");
  return db.collection("leituras_rejeitadas");
}

export async function desconectarMongoDB(): Promise<void> {
  if (client) {
    await client.close();
    console.log("✓ Desconectado do MongoDB");
  }
}
