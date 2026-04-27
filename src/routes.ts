import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { processarLeituras } from "./processor";
import { getColecaoRaw } from "./db";

export async function routes(fastify: FastifyInstance, _options: FastifyPluginOptions) {
  fastify.get("/health", async () => {
    return { status: "ok" };
  });

  fastify.post("/processar", async () => {
    try {
      const colecaoRaw = getColecaoRaw();
      await processarLeituras(colecaoRaw);
      return { sucesso: true, mensagem: "Processamento concluído" };
    } catch (erro) {
      throw erro;
    }
  });
}
