import type { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import { processarLeituras } from "./processor";
import { getColecaoRaw } from "./db";
import { iniciarScheduler, pararScheduler, reiniciarScheduler, statusScheduler } from "./scheduler";
import { ProcessarLeituraRequest, ProcessarLeituraResponse } from "./types";

export async function routes(fastify: FastifyInstance, _options: FastifyPluginOptions) {
  fastify.get("/health", async () => {
    return { status: "ok" };
  });

  fastify.post<{ Body: ProcessarLeituraRequest }>(
    "/processar",
    async (request: FastifyRequest<{ Body: ProcessarLeituraRequest }>, reply: FastifyReply) => {
      const inicio = Date.now();
      
      try {
        const colecaoRaw = getColecaoRaw();
        
        const opcoes = {
          tipos_sensores: request.body?.tipos_sensores,
          uids: request.body?.uids,
          data_inicio: request.body?.data_inicio,
          data_fim: request.body?.data_fim,
          estrategia_valores_nulos: request.body?.estrategia_valores_nulos || "registrar_nulo",
          normalizar_unidades: request.body?.normalizar_unidades !== false,
          limite_leituras: request.body?.limite_leituras || 100,
          reprocessar_invalidas: request.body?.reprocessar_invalidas || false
        };

        const estatisticas = await processarLeituras(colecaoRaw, opcoes);
        const tempoMs = Date.now() - inicio;

        const resposta: ProcessarLeituraResponse = {
          sucesso: true,
          mensagem: "Processamento concluído com sucesso",
          estatisticas: {
            ...estatisticas,
            tempo_ms: tempoMs
          }
        };

        return reply.code(200).send(resposta);
      } catch (erro) {
        const tempoMs = Date.now() - inicio;
        console.error("[ROUTES] Erro na requisição /processar:", erro);

        const resposta: ProcessarLeituraResponse = {
          sucesso: false,
          mensagem: "Erro ao processar leituras",
          estatisticas: {
            total_processadas: 0,
            total_validas: 0,
            total_rejeitadas: 0,
            total_interpoladas: 0,
            tempo_ms: tempoMs
          },
          erros: [String(erro)]
        };

        return reply.code(500).send(resposta);
      }
    }
  );

  fastify.post("/scheduler/iniciar", async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    try {
      const config = request.body || {};
      await iniciarScheduler(config);

      return reply.code(200).send({
        sucesso: true,
        mensagem: "Scheduler iniciado",
        status: statusScheduler()
      });
    } catch (erro) {
      console.error("[ROUTES] Erro ao iniciar scheduler:", erro);
      return reply.code(500).send({
        sucesso: false,
        mensagem: "Erro ao iniciar scheduler",
        erros: [String(erro)]
      });
    }
  });

  fastify.post("/scheduler/parar", async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      pararScheduler();

      return reply.code(200).send({
        sucesso: true,
        mensagem: "Scheduler parado",
        status: statusScheduler()
      });
    } catch (erro) {
      console.error("[ROUTES] Erro ao parar scheduler:", erro);
      return reply.code(500).send({
        sucesso: false,
        mensagem: "Erro ao parar scheduler",
        erros: [String(erro)]
      });
    }
  });

  fastify.post("/scheduler/reiniciar", async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    try {
      const config = request.body || {};
      await reiniciarScheduler(config);

      return reply.code(200).send({
        sucesso: true,
        mensagem: "Scheduler reiniciado",
        status: statusScheduler()
      });
    } catch (erro) {
      console.error("[ROUTES] Erro ao reiniciar scheduler:", erro);
      return reply.code(500).send({
        sucesso: false,
        mensagem: "Erro ao reiniciar scheduler",
        erros: [String(erro)]
      });
    }
  });

  fastify.get("/scheduler/status", async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.code(200).send({
      sucesso: true,
      status: statusScheduler()
    });
  });
}
