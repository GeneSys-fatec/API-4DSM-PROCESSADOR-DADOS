import { Collection } from "mongodb";

export async function buscarDadosDoReceptor(
  colecaoRaw: Collection
): Promise<{ novos: number; erros: number }> {
  return { novos: 0, erros: 0 };
}

export async function iniciarSincronizacao(
  colecaoRaw: Collection,
  intervaloMs: number = 30000
) {
  console.log(`Sincronização iniciada (a cada ${intervaloMs}ms)`);

  await buscarDadosDoReceptor(colecaoRaw);

  setInterval(async () => {
    await buscarDadosDoReceptor(colecaoRaw);
  }, intervaloMs);
}
