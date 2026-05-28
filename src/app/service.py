from __future__ import annotations

import logging
import time
from dataclasses import dataclass

import pandas as pd

from sensor_processor.cleaning import clean_measurements
from sensor_processor.models import ProcessingConfig

from .alerts import trigger_alert_evaluation
from .db import db
from .schemas import ProcessingStats, ProcessRequest

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class ProcessOutcome:
    stats: ProcessingStats
    rejected_frame: pd.DataFrame


def build_mongo_filter(request: ProcessRequest) -> dict:
    mongo_filter: dict = {}

    if request.tipos_sensores:
        patterns = {
            "pluviometro": "PLUVIOMETRO",
            "qualidade_ar": "QUALIDADE_AR",
            "solo": "SOLO",
        }
        mongo_filter["uid"] = {
            "$regex": "|".join(patterns[item] for item in request.tipos_sensores)
        }

    if request.uids:
        mongo_filter["uid"] = {"$in": request.uids}

    if request.data_inicio is not None or request.data_fim is not None:
        mongo_filter["unixtime"] = {}
        if request.data_inicio is not None:
            mongo_filter["unixtime"]["$gte"] = request.data_inicio
        if request.data_fim is not None:
            mongo_filter["unixtime"]["$lte"] = request.data_fim

    if not request.reprocessar_invalidas:
        mongo_filter["_processada"] = {"$ne": True}

    return mongo_filter


def process_readings(request: ProcessRequest) -> ProcessOutcome:
    start = time.perf_counter()
    db.connect()
    mongo_filter = build_mongo_filter(request)
    raw_documents = db.fetch_raw_readings(mongo_filter, request.limite_leituras)

    logger.info("Processing %s raw readings", len(raw_documents))

    if not raw_documents:
        empty = pd.DataFrame()
        stats = ProcessingStats(
            total_processadas=0,
            total_validas=0,
            total_rejeitadas=0,
            total_interpoladas=0,
            total_duplicatas=0,
            total_agregadas=0,
            tempo_ms=int((time.perf_counter() - start) * 1000),
        )
        return ProcessOutcome(stats=stats, rejected_frame=empty)

    clean_config = ProcessingConfig(
        null_strategy=request.estrategia_valores_nulos,
        normalize_units=request.normalizar_unidades,
        drop_duplicates=True,
    )

    cleaned = clean_measurements(raw_documents, clean_config)
    measurement_rows = _explode_measurements(cleaned.clean_frame)

    saved_records = db.save_measurements(measurement_rows)

    for record in saved_records:
        param_id = record[2]
        value = record[5]
        collected_at = record[6]
        if param_id is not None and value is not None:
            trigger_alert_evaluation(param_id, float(value), collected_at)

    raw_ids = list(cleaned.clean_frame.get("_id", []))
    try:
        db.delete_raw_sent(raw_ids)
    except Exception:
        logger.exception("Falha ao excluir documentos do MongoDB")

    elapsed_ms = int((time.perf_counter() - start) * 1000)
    stats = ProcessingStats(
        total_processadas=cleaned.total_received,
        total_validas=cleaned.total_valid,
        total_rejeitadas=cleaned.total_rejected,
        total_interpoladas=0,
        total_duplicatas=cleaned.total_duplicates,
        total_agregadas=0,
        tempo_ms=elapsed_ms,
    )

    logger.info(
        "Processing finished: valid=%s rejected=%s elapsed_ms=%s",
        cleaned.total_valid,
        cleaned.total_rejected,
        elapsed_ms,
    )
    return ProcessOutcome(stats=stats, rejected_frame=cleaned.rejected_frame)


def _explode_measurements(frame: pd.DataFrame) -> pd.DataFrame:
    if frame.empty:
        return frame

    value_columns = [
        column
        for column in frame.columns
        if column
        not in {
            "_id",
            "uid",
            "sensor_type",
            "unixtime",
            "sensor_type",
            "reject_reason",
        }
        and pd.api.types.is_numeric_dtype(frame[column])
    ]

    rows = []
    for record in frame.to_dict(orient="records"):
        collected_at = pd.to_datetime(record["unixtime"], unit="s", utc=True)
        for column in value_columns:
            value = record.get(column)
            if value is None or pd.isna(value):
                continue
            rows.append(
                {
                    "sensor_uid": record["uid"],
                    "sensor_type": record["sensor_type"],
                    "parameter_name": column,
                    "raw_value": value,
                    "value": value,
                    "collected_at": collected_at,
                }
            )

    return pd.DataFrame(rows)
