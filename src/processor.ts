// processor.ts

import { Collection } from "mongodb";
import { validarRange, getTipo } from "./validators";
import { isDuplicata } from "./deduplicator";
import { normalizarLeitura } from "./normalizer";
import { SensorLeitura, LeituraTratada, LeituraRejeitada } from "./types";

export async function processarLeituras(
  colecaoRaw: Collection,
  colecaoTratada: Collection,
  colecaoRejeitada: Collection
) {
  const leituras = await colecaoRaw
    .find({ _processada: { $ne: true } })
    .limit(100)
    .toArray();

  console.log(`Processando ${leituras.length} leituras...`);

  for (const doc of leituras) {
    const leitura = doc as any as SensorLeitura;

    try {
      // 1. Verificar duplicata
      if (isDuplicata(leitura)) {
        await colecaoRejeitada.insertOne({
          leitura_original: leitura,
          motivo: "Duplicata detectada",
          timestamp: new Date()
        });
        continue;
      }

      // 2. Validar range
      const tipo = getTipo(leitura.uid);
      const { valido, erros } = validarRange(leitura, tipo);

      if (!valido) {
        await colecaoRejeitada.insertOne({
          leitura_original: leitura,
          motivo: erros.join("; "),
          timestamp: new Date()
        });
        continue;
      }

      // 3. Normalizar
      const normalizada = normalizarLeitura(leitura, tipo);

      // 4. Salvar tratada
      const tratada: LeituraTratada = {
        ...normalizada,
        processamento: {
          timestamp: new Date(),
          status: "válido",
          regras_aplicadas: ["deduplicacao", "validacao_range", "normalizacao"],
          interpolacoes: []
        }
      };

      await colecaoTratada.insertOne(tratada);
      console.log(`✓ ${leitura.uid} processada`);
    } catch (erro) {
      console.error(`✗ Erro processando ${leitura.uid}:`, erro);
      await colecaoRejeitada.insertOne({
        leitura_original: leitura,
        motivo: String(erro),
        timestamp: new Date()
      });
    }

    // Marcar como processada
    await colecaoRaw.updateOne({ _id: doc._id }, { $set: { _processada: true } });
  }

  console.log("Processamento concluído!");
}
