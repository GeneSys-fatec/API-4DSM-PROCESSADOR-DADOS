from __future__ import annotations

import logging

from fastapi import Body, FastAPI, HTTPException

from .config import settings
from .db import db
from .scheduler import scheduler
from .schemas import ProcessRequest, ProcessResponse, SchedulerResponse, SchedulerStatus
from .service import process_readings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

app = FastAPI(title="Sensor Processor", version="1.0.0")


@app.on_event("startup")
async def startup() -> None:
    db.connect()

    if settings.scheduler_enable:
        await scheduler.start()


@app.on_event("shutdown")
async def shutdown() -> None:
    await scheduler.stop()
    db.close()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/processar", response_model=ProcessResponse)
def process_endpoint(request: ProcessRequest) -> ProcessResponse:
    try:
        outcome = process_readings(request)
        return ProcessResponse(
            sucesso=True,
            mensagem="Processamento concluído com sucesso",
            estatisticas=outcome.stats,
        )
    except Exception as exc:
        logging.exception("Falha ao processar as leituras")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/scheduler/iniciar", response_model=SchedulerResponse)
async def start_scheduler(request: ProcessRequest | None = Body(default=None)) -> SchedulerResponse:
    await scheduler.start(request)
    return SchedulerResponse(
        sucesso=True,
        mensagem="Scheduler iniciado",
        status=scheduler.snapshot(),
    )


@app.post("/scheduler/parar", response_model=SchedulerResponse)
async def stop_scheduler() -> SchedulerResponse:
    await scheduler.stop()
    return SchedulerResponse(
        sucesso=True,
        mensagem="Scheduler parado",
        status=scheduler.snapshot(),
    )


@app.post("/scheduler/reiniciar", response_model=SchedulerResponse)
async def restart_scheduler() -> SchedulerResponse:
    await scheduler.restart()
    return SchedulerResponse(
        sucesso=True,
        mensagem="Scheduler reiniciado",
        status=scheduler.snapshot(),
    )


@app.get("/scheduler/status", response_model=SchedulerStatus)
def scheduler_status() -> SchedulerStatus:
    return scheduler.snapshot()