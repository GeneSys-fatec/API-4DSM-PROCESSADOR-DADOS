from __future__ import annotations

import logging
from typing import Iterable

import pandas as pd

from .models import ProcessingConfig, ProcessingResult

logger = logging.getLogger(__name__)

SENSOR_RULES = {
    "pluviometro": {
        "numeric": ["chuva_mm", "umidade", "temperatura"],
        "range": {
            "chuva_mm": (0, 1000),
            "umidade": (0, 100),
            "temperatura": (-50, 60),
        },
    },
    "qualidade_ar": {
        "numeric": ["co2", "pm25", "qualidade_index"],
        "range": {
            "co2": (200, 5000),
            "pm25": (0, 500),
            "qualidade_index": (1, 5),
        },
    },
    "solo": {
        "numeric": ["umidade_solo", "ph", "temp_solo"],
        "range": {
            "umidade_solo": (0, 100),
            "ph": (3, 10),
            "temp_solo": (-20, 60),
        },
    },
}


def clean_measurements(
    data: Iterable[dict] | pd.DataFrame,
    config: ProcessingConfig | None = None,
) -> ProcessingResult:
    config = config or ProcessingConfig()
    started_at = pd.Timestamp.utcnow().to_pydatetime()

    try:
        frame = _ensure_dataframe(data)
        if frame.empty:
            empty = frame.copy()
            return ProcessingResult(
                clean_frame=empty,
                rejected_frame=empty,
                duplicates_frame=empty,
                total_received=0,
                total_valid=0,
                total_rejected=0,
                total_duplicates=0,
                started_at=started_at,
                finished_at=pd.Timestamp.utcnow().to_pydatetime(),
            )

        working = frame.copy()
        working["sensor_type"] = working["uid"].map(_infer_sensor_type)

        rejected_frames: list[pd.DataFrame] = []
        invalid_type_mask = working["sensor_type"].eq("unknown")
        if invalid_type_mask.any():
            rejected_frames.append(
                working.loc[invalid_type_mask].assign(
                    reject_reason="unknown_sensor_type"
                )
            )
            working = working.loc[~invalid_type_mask].copy()

        if working.empty:
            rejected = _concat_frames(rejected_frames)
            return ProcessingResult(
                clean_frame=working,
                rejected_frame=rejected,
                duplicates_frame=frame.iloc[0:0].copy(),
                total_received=len(frame),
                total_valid=0,
                total_rejected=len(rejected),
                total_duplicates=0,
                started_at=started_at,
                finished_at=pd.Timestamp.utcnow().to_pydatetime(),
            )

        working = _coerce_numeric_columns(working)
        working = _drop_rows_with_invalid_required_fields(working)

        if config.normalize_units:
            working = _normalize_units(working)

        working, range_rejected = _validate_ranges(working)
        rejected_frames.append(range_rejected)

        if config.null_strategy == "ignore":
            working, null_rejected = _drop_rows_with_nulls(working)
            rejected_frames.append(null_rejected)
        elif config.null_strategy == "interpolate":
            working = _interpolate_missing_values(working)

        duplicates_mask = working.duplicated(subset=["uid", "unixtime"], keep="first")
        duplicates_frame = working.loc[duplicates_mask].copy()
        if config.drop_duplicates:
            working = working.loc[~duplicates_mask].copy()

        rejected = _concat_frames(rejected_frames)
        return ProcessingResult(
            clean_frame=working.reset_index(drop=True),
            rejected_frame=rejected.reset_index(drop=True),
            duplicates_frame=duplicates_frame.reset_index(drop=True),
            total_received=len(frame),
            total_valid=len(working),
            total_rejected=len(rejected),
            total_duplicates=len(duplicates_frame),
            started_at=started_at,
            finished_at=pd.Timestamp.utcnow().to_pydatetime(),
        )
    except Exception as exc: 
        logger.exception("Falha ao limpar as medições: %s", exc)
        raise


def _ensure_dataframe(data: Iterable[dict] | pd.DataFrame) -> pd.DataFrame:
    if isinstance(data, pd.DataFrame):
        return data.copy()
    return pd.DataFrame(list(data))


def _infer_sensor_type(uid: str) -> str:
    uid_upper = str(uid).upper()
    if "PLUVIOMETRO" in uid_upper:
        return "pluviometro"
    if "QUALIDADE_AR" in uid_upper:
        return "qualidade_ar"
    if "SOLO" in uid_upper:
        return "solo"
    return "unknown"


def _coerce_numeric_columns(frame: pd.DataFrame) -> pd.DataFrame:
    converted = frame.copy()
    columns_to_convert = [
        column
        for column in converted.columns
        if column not in {"_id", "uid", "sensor_type", "reject_reason"}
    ]
    for column in columns_to_convert:
        converted[column] = pd.to_numeric(converted[column], errors="coerce")
    return converted


def _drop_rows_with_invalid_required_fields(frame: pd.DataFrame) -> pd.DataFrame:
    required_mask = frame["uid"].notna() & frame["unixtime"].notna()
    return frame.loc[required_mask].copy()


def _validate_ranges(frame: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    valid_mask = pd.Series(True, index=frame.index)
    rejected_frames: list[pd.DataFrame] = []

    for sensor_type, rules in SENSOR_RULES.items():
        sensor_mask = frame["sensor_type"].eq(sensor_type)
        subset = frame.loc[sensor_mask]
        if subset.empty:
            continue

        for column, (min_value, max_value) in rules["range"].items():
            column_mask = subset[column].between(min_value, max_value, inclusive="both") | subset[column].isna()
            invalid_index = subset.index[~column_mask]
            if len(invalid_index) > 0:
                valid_mask.loc[invalid_index] = False
                rejected_frames.append(
                    subset.loc[invalid_index].assign(
                        reject_reason=f"{column}_out_of_range"
                    )
                )

    return frame.loc[valid_mask].copy(), _concat_frames(rejected_frames)


def _drop_rows_with_nulls(frame: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    null_columns = [
        column
        for column in frame.columns
        if column not in {"uid", "unixtime", "sensor_type", "reject_reason"}
    ]
    null_mask = frame[null_columns].isna().any(axis=1)
    rejected = frame.loc[null_mask].assign(reject_reason="null_values").copy()
    return frame.loc[~null_mask].copy(), rejected


def _interpolate_missing_values(frame: pd.DataFrame) -> pd.DataFrame:
    interpolated_frames = []

    for (_, _sensor_type), group in frame.sort_values(["uid", "unixtime"]).groupby(["uid", "sensor_type"], sort=False):
        subset = group.copy()
        sensor_type = subset["sensor_type"].iloc[0]
        columns = [
            column
            for column in SENSOR_RULES.get(sensor_type, {}).get("numeric", [])
            if column in subset.columns
        ]
        if columns:
            subset.loc[:, columns] = subset.loc[:, columns].interpolate(
                method="linear",
                limit_direction="both",
            )
        interpolated_frames.append(subset)

    return pd.concat(interpolated_frames, ignore_index=True)


def _normalize_units(frame: pd.DataFrame) -> pd.DataFrame:
    normalized = frame.copy()

    pluviometro = normalized["sensor_type"].eq("pluviometro")
    if "chuva_mm" in normalized.columns:
        normalized.loc[pluviometro, "chuva_mm"] = normalized.loc[pluviometro, "chuva_mm"].abs()
    if "umidade" in normalized.columns:
        normalized.loc[pluviometro, "umidade"] = normalized.loc[pluviometro, "umidade"].clip(0, 100)

    qualidade_ar = normalized["sensor_type"].eq("qualidade_ar")
    if "co2" in normalized.columns:
        normalized.loc[qualidade_ar, "co2"] = normalized.loc[qualidade_ar, "co2"].clip(200, 5000)
    if "pm25" in normalized.columns:
        normalized.loc[qualidade_ar, "pm25"] = normalized.loc[qualidade_ar, "pm25"].clip(lower=0)
    if "qualidade_index" in normalized.columns:
        normalized.loc[qualidade_ar, "qualidade_index"] = (
            normalized.loc[qualidade_ar, "qualidade_index"].round().clip(1, 5)
        )

    solo = normalized["sensor_type"].eq("solo")
    if "umidade_solo" in normalized.columns:
        normalized.loc[solo, "umidade_solo"] = normalized.loc[solo, "umidade_solo"].clip(0, 100)
    if "ph" in normalized.columns:
        normalized.loc[solo, "ph"] = normalized.loc[solo, "ph"].clip(3, 10)

    return normalized


def _concat_frames(frames: list[pd.DataFrame]) -> pd.DataFrame:
    valid_frames = [frame for frame in frames if not frame.empty]
    if not valid_frames:
        return pd.DataFrame()
    return pd.concat(valid_frames, ignore_index=True)