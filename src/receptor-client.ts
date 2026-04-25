// receptor-client.ts

import axios from "axios";
import { Collection } from "mongodb";

const RECEPTOR_URL = process.env.RECEPTOR_URL || "http://localhost:5000";

export async function buscarDadosDoReceptor(
  colecaoRaw: Collection
): Promise<{ novos: number; erros: number }> {
  let novos = 0;
  let erros = 0;

  try {
    console.log(`[Receptor] Conectando em ${RECEPTOR_URL}...`);

    const response = await axios.get(`${RECEPTOR_URL}/dados-brutos`, {
      timeout: 10000
    });

    const dados = response.data;

    if (Array.isArray(dados)) {
      for (const item of dados) {
        try {
          // Verificar se já existe para evitar duplicatas
          const existe = await colecaoRaw.findOne({ _id: item._id });

          if (!existe) {
            // Marcar como não processado
            item._processada = false;
            item._data_insercao = new Date();

            await colecaoRaw.insertOne(item);
            novos++;
            console.log(`[Receptor] ✓ Dado inserido: ${item.uid}`);
          }
        } catch (erro) {
          erros++;
          console.error(`[Receptor] Erro ao processar item:`, erro);
        }
      }
    }

    console.log(
      `[Receptor] Sincronização concluída: ${novos} novos, ${erros} erros`
    );
    return { novos, erros };
  } catch (erro: any) {
    console.error(`[Receptor] Erro de conexão:`, erro.message);
    return { novos: 0, erros: 1 };
  }
}

export async function iniciarSincronizacao(
  colecaoRaw: Collection,
  intervaloMs: number = 30000
) {
  console.log(`[Receptor] Sincronização iniciada (a cada ${intervaloMs}ms)`);

  // Primeira sincronização imediata
  await buscarDadosDoReceptor(colecaoRaw);

  // Sincronizar periodicamente
  setInterval(async () => {
    await buscarDadosDoReceptor(colecaoRaw);
  }, intervaloMs);
}
