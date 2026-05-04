from __future__ import annotations

import logging

import pandas as pd

from .models import AggregationConfig, AggregationResult

logger = logging.getLogger(__name__)


def aggregate_measurements(
    clean_data: pd.DataFrame,
    config: AggregationConfig | None = None,
) -> AggregationResult:
    config = config or AggregationConfig()

    try:
        if clean_data.empty:
            empty = clean_data.copy()
            return AggregationResult(frame=empty, period=config.period, total_groups=0)

        frame = clean_data.copy()
        frame["collected_at"] = pd.to_datetime(frame["unixtime"], unit="s", utc=True)
        freq = "h" if config.period == "hour" else "D"
        frame["period_start"] = frame["collected_at"].dt.floor(freq)

        excluded_columns = {
            "uid",
            "unixtime",
            "sensor_type",
            "collected_at",
            "period_start",
            "reject_reason",
        }
        value_columns = [
            column
            for column in frame.columns
            if column not in excluded_columns and pd.api.types.is_numeric_dtype(frame[column])
        ]

        grouped = (
            frame.groupby(["uid", "sensor_type", "period_start"], dropna=False)[value_columns]
            .agg(["mean", "max", "min", "count"])
        )
        grouped.columns = [f"{value}_{agg}" for value, agg in grouped.columns.to_flat_index()]

        result = grouped.reset_index()
        result["aggregation_period"] = config.period

        return AggregationResult(
            frame=result,
            period=config.period,
            total_groups=len(result),
        )
    except Exception as exc: 
        logger.exception("Falha ao agregar as medições: %s", exc)
        raise