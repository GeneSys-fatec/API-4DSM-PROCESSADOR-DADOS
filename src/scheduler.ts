// src/scheduler.ts

import { getColecaoRaw } from "./db";
import { processarLeituras } from "./processor";
import { ProcessarLeituraOpcoes } from "./processor";

let timerInterval: NodeJS.Timeout | null = null;
let isRunning = false;

export interface SchedulerConfig {
  intervalo_ms: number; // Intervalo em milissegundos (default: 60000 = 1 min)
  opcoes_processamento?: Partial<ProcessarLeituraOpcoes>;
}

const DEFAULT_CONFIG: SchedulerConfig = {
  intervalo_ms: 60000, // 1 minuto
  opcoes_processamento: {
    limite_leituras: 100,
    estrategia_valores_nulos: "registrar_nulo",
    normalizar_unidades: true
  }
};

let ultimaExecucao: Date | undefined = undefined;

export async function iniciarScheduler(config: Partial<SchedulerConfig> = {}): Promise<void> {
  if (isRunning) {
    console.log("[SCHEDULER] Scheduler já está rodando!");
    return;
  }

  const configMerged = { ...DEFAULT_CONFIG, ...config };
  isRunning = true;

  console.log(`[SCHEDULER] Iniciado com intervalo de ${configMerged.intervalo_ms}ms (${(configMerged.intervalo_ms / 1000).toFixed(1)}s)`);

  await executarProcessamento(configMerged);

  timerInterval = setInterval(async () => {
    await executarProcessamento(configMerged);
  }, configMerged.intervalo_ms);
}

export function pararScheduler(): void {
  if (!isRunning) {
    console.log("[SCHEDULER] Scheduler não está rodando!");
    return;
  }

  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  isRunning = false;
  console.log("[SCHEDULER] Scheduler parado");
}

export function statusScheduler(): {
  rodando: boolean;
  ultima_execucao?: Date;
  proxima_execucao?: Date;
} {
  return {
    rodando: isRunning,
    ultima_execucao: ultimaExecucao,
    proxima_execucao: isRunning && ultimaExecucao ? new Date(ultimaExecucao.getTime() + (DEFAULT_CONFIG.intervalo_ms)) : undefined
  };
}

async function executarProcessamento(config: SchedulerConfig): Promise<void> {
  const inicio = Date.now();
  
  try {
    console.log(`[SCHEDULER] Acionando processamento...`);
    
    const colecaoRaw = getColecaoRaw();
    const resultado = await processarLeituras(colecaoRaw, config.opcoes_processamento);
    
    ultimaExecucao = new Date();
    const duracao = Date.now() - inicio;

    console.log(`[SCHEDULER] Processamento concluído em ${duracao}ms:`);
    console.log(`  Total: ${resultado.total_processadas}`);
    console.log(`  Válidas: ${resultado.total_validas}`);
    console.log(`  Rejeitadas: ${resultado.total_rejeitadas}`);
    console.log(`  Interpoladas: ${resultado.total_interpoladas}`);
  } catch (erro) {
    const duracao = Date.now() - inicio;
    console.error(`[SCHEDULER] Erro no processamento (${duracao}ms):`, erro);
  }
}

export async function reiniciarScheduler(config: Partial<SchedulerConfig> = {}): Promise<void> {
  pararScheduler();
  await iniciarScheduler(config);
}
