// server.ts

import express from "express";
import dotenv from "dotenv";
import { conectarMongoDB, getColecaoRaw, getColecaoTratada, getColecaoRejeitada, desconectarMongoDB } from "./db";
import { processarLeituras } from "./processor";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";

app.use(express.json());

app.post("/processar", async (req, res) => {
  try {
    const colecaoRaw = getColecaoRaw();
    const colecaoTratada = getColecaoTratada();
    const colecaoRejeitada = getColecaoRejeitada();

    await processarLeituras(colecaoRaw, colecaoTratada, colecaoRejeitada);

    res.json({ sucesso: true, mensagem: "Processamento concluído" });
  } catch (erro) {
    res.status(500).json({ erro: String(erro) });
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

async function iniciar() {
  try {
    await conectarMongoDB(MONGO_URI);
    app.listen(PORT, () => {
      console.log(`Servidor rodando em http://localhost:${PORT}`);
    });
  } catch (erro) {
    console.error("Erro ao iniciar:", erro);
    process.exit(1);
  }
}

process.on("SIGINT", async () => {
  console.log("\nEncerrando...");
  await desconectarMongoDB();
  process.exit(0);
});

iniciar();
