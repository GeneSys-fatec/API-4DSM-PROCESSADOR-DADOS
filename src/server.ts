import "reflect-metadata";
import fastify from "fastify";
import dotenv from "dotenv";
import { AppDataSource, conectarMongoDB, desconectarMongoDB } from "./db";
import { routes } from "./routes";
import { iniciarScheduler, pararScheduler } from "./scheduler";

dotenv.config();

const app = fastify();
const PORT = parseInt(process.env.PORT || "3000");
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://gbmedeiros00:123@api-4dsm.u46aa51.mongodb.net/sensor_data?retryWrites=true&w=majority";
const SCHEDULER_ATIVO = process.env.SCHEDULER_ENABLE === "true";
const SCHEDULER_INTERVALO = parseInt(process.env.SCHEDULER_INTERVAL_MS || "60000");

const start = async () => {
  try {
  
    await AppDataSource.initialize();
    console.log("[SERVER] ✓ PostgreSQL conectado");
    
    await conectarMongoDB(MONGO_URI);
    console.log("[SERVER] ✓ MongoDB conectado");
    
    await app.register(routes);
    
    // Inicia scheduler se habilitado
    if (SCHEDULER_ATIVO) {
      console.log(`[SERVER] ✓ Scheduler habilitado (intervalo: ${SCHEDULER_INTERVALO}ms)`);
      await iniciarScheduler({
        intervalo_ms: SCHEDULER_INTERVALO,
        opcoes_processamento: {
          limite_leituras: 100,
          estrategia_valores_nulos: "registrar_nulo",
          normalizar_unidades: true
        }
      });
    } else {
      console.log("[SERVER] ℹ️  Scheduler desabilitado (use SCHEDULER_ENABLE=true para ativar)");
    }
    
    await app.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`[SERVER] ✓ Servidor rodando em http://localhost:${PORT}`);
  } catch (erro) {
    console.error("[SERVER] ✗ Erro ao iniciar:", erro);
    process.exit(1);
  }
};

process.on("SIGINT", async () => {
  console.log("\n[SERVER] 🛑 Encerrando...");
  
  try {
    if (SCHEDULER_ATIVO) {
      pararScheduler();
    }
    
    await app.close();
    await desconectarMongoDB();
    
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
    
    console.log("[SERVER] ✓ Encerrado com sucesso");
    process.exit(0);
  } catch (erro) {
    console.error("[SERVER] ✗ Erro ao encerrar:", erro);
    process.exit(1);
  }
});

start();
