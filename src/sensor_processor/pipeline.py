from __future__ import annotations

from typing import Iterable

import pandas as pd

from .aggregation import aggregate_measurements
from .cleaning import clean_measurements
from .models import AggregationConfig, AggregationResult, ProcessingConfig, ProcessingResult


def process_sensor_batch(
    raw_data: Iterable[dict] | pd.DataFrame,
    processing_config: ProcessingConfig | None = None,
    aggregation_config: AggregationConfig | None = None,
) -> tuple[ProcessingResult, AggregationResult]:
    cleaned = clean_measurements(raw_data, config=processing_config)
    aggregated = aggregate_measurements(cleaned.clean_frame, config=aggregation_config)
    return cleaned, aggregated
