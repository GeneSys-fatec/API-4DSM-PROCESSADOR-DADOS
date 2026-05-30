from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

SensorType = Literal["pluviometro", "qualidade_ar", "solo"]
NullStrategy = Literal["ignore", "keep_null", "interpolate"]
AggregationPeriod = Literal["hour", "day"]


class ProcessingStatus(str, Enum):
    VALID = "valid"
    INVALID = "invalid"


class SensorReading(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    uid: str = Field(..., min_length=1)
    unixtime: int = Field(..., ge=0)

    chuva_mm: Optional[float] = None
    umidade: Optional[float] = None
    temperatura: Optional[float] = None

    co2: Optional[float] = None
    pm25: Optional[float] = None
    qualidade_index: Optional[float] = None

    umidade_solo: Optional[float] = None
    ph: Optional[float] = None
    temp_solo: Optional[float] = None

    @field_validator("uid")
    @classmethod
    def strip_uid(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("O uid não pode estar vazio")
        return value


@dataclass(slots=True)
class ProcessingConfig:
    null_strategy: NullStrategy = "keep_null"
    normalize_units: bool = True
    drop_duplicates: bool = True


@dataclass(slots=True)
class ProcessingResult:
    clean_frame: Any
    rejected_frame: Any
    duplicates_frame: Any
    total_received: int
    total_valid: int
    total_rejected: int
    total_duplicates: int
    started_at: datetime = field(default_factory=datetime.utcnow)
    finished_at: datetime = field(default_factory=datetime.utcnow)


@dataclass(slots=True)
class AggregationConfig:
    period: AggregationPeriod = "hour"


@dataclass(slots=True)
class AggregationResult:
    frame: Any
    period: AggregationPeriod
    total_groups: int
    generated_at: datetime = field(default_factory=datetime.utcnow)
