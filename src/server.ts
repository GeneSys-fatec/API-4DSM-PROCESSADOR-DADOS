// server.ts

import express from "express";
import dotenv from "dotenv";
import { conectarMongoDB, getColecaoRaw, getColecaoTratada, getColecaoRejeitada, desconectarMongoDB } from "./db";
import { processarLeituras } from "./processor";
import { buscarDadosDoReceptor, iniciarSincronizacao } from "./receptor-client";

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

app.post("/sincronizar-receptor", async (req, res) => {
  try {
    const colecaoRaw = getColecaoRaw();
    const resultado = await buscarDadosDoReceptor(colecaoRaw);

    res.json({
      sucesso: true,
      mensagem: "Sincronização com receptor concluída",
      novos: resultado.novos,
      erros: resultado.erros
    });
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

    const colecaoRaw = getColecaoRaw();
    const sincronizarIntervalo = parseInt(process.env.SINCRONIZAR_INTERVALO_MS || "30000", 10);

    // Iniciar sincronização automática com o receptor
    iniciarSincronizacao(colecaoRaw, sincronizarIntervalo);

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
