from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


SensorKind = Literal["pluviometro", "qualidade_ar", "solo"]
NullStrategy = Literal["ignore", "keep_null", "interpolate"]


class ProcessRequest(BaseModel):
    tipos_sensores: Optional[list[SensorKind]] = None
    uids: Optional[list[str]] = None
    data_inicio: Optional[int] = None
    data_fim: Optional[int] = None
    estrategia_valores_nulos: NullStrategy = "keep_null"
    normalizar_unidades: bool = True
    limite_leituras: int = Field(default=100, ge=1, le=10_000)
    reprocessar_invalidas: bool = False


class ProcessingStats(BaseModel):
    total_processadas: int
    total_validas: int
    total_rejeitadas: int
    total_interpoladas: int
    total_duplicatas: int
    total_agregadas: int
    tempo_ms: int


class ProcessResponse(BaseModel):
    sucesso: bool
    mensagem: str
    estatisticas: ProcessingStats
    erros: Optional[list[str]] = None


class SchedulerStatus(BaseModel):
    rodando: bool
    ultima_execucao: Optional[str] = None
    proxima_execucao: Optional[str] = None


class SchedulerResponse(BaseModel):
    sucesso: bool
    mensagem: str
    status: SchedulerStatus
    erros: Optional[list[str]] = None