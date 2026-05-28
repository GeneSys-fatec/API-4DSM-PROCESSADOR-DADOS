from __future__ import annotations

import pandas as pd

from sensor_processor.aggregation import aggregate_measurements
from sensor_processor.models import AggregationConfig


def test_aggregate_measurements_calculates_hourly_metrics() -> None:
    clean = pd.DataFrame(
        [
            {
                "uid": "PLUVIOMETRO-001",
                "sensor_type": "pluviometro",
                "unixtime": 1702834800,
                "chuva_mm": 2,
                "umidade": 60,
                "temperatura": 20,
            },
            {
                "uid": "PLUVIOMETRO-001",
                "sensor_type": "pluviometro",
                "unixtime": 1702838400,
                "chuva_mm": 4,
                "umidade": 70,
                "temperatura": 24,
            },
        ]
    )

    result = aggregate_measurements(clean, AggregationConfig(period="hour"))

    assert result.total_groups == 2
    assert "temperatura_mean" in result.frame.columns
    assert "chuva_mm_max" in result.frame.columns


def test_aggregate_measurements_calculates_daily_metrics() -> None:
    clean = pd.DataFrame(
        [
            {
                "uid": "SOLO-001",
                "sensor_type": "solo",
                "unixtime": 1702834800,
                "umidade_solo": 40,
                "ph": 6,
                "temp_solo": 18,
            },
            {
                "uid": "SOLO-001",
                "sensor_type": "solo",
                "unixtime": 1702842000,
                "umidade_solo": 50,
                "ph": 7,
                "temp_solo": 20,
            },
        ]
    )

    result = aggregate_measurements(clean, AggregationConfig(period="day"))

    assert result.total_groups == 1
    assert result.frame.iloc[0]["umidade_solo_mean"] == 45
    assert result.frame.iloc[0]["ph_max"] == 7