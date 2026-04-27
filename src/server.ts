import "reflect-metadata";
import fastify from "fastify";
import dotenv from "dotenv";
import { AppDataSource, conectarMongoDB, desconectarMongoDB, getColecaoRaw } from "./db";
import { routes } from "./routes";

dotenv.config();

const app = fastify();
const PORT = parseInt(process.env.PORT || "3000");
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://gbmedeiros00:123@api-4dsm.u46aa51.mongodb.net/?appName=API-4DSM";

const start = async () => {
  try {
    await AppDataSource.initialize();
    await conectarMongoDB(MONGO_URI);
    await app.register(routes);
    await app.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  } catch (erro) {
    console.error("Erro ao iniciar:", erro);
    process.exit(1);
  }
};

process.on("SIGINT", async () => {
  console.log("Encerrando...");
  await app.close();
  await desconectarMongoDB();
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(0);
});

start();
