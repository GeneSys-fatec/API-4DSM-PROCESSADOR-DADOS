from __future__ import annotations

import pandas as pd

from sensor_processor.aggregation import aggregate_measurements
from sensor_processor.cleaning import clean_measurements
from sensor_processor.models import AggregationConfig, ProcessingConfig


def test_clean_measurements_drops_outliers_and_duplicates() -> None:
    raw = [
        {
            "uid": "PLUVIOMETRO-001",
            "unixtime": 1702834800,
            "chuva_mm": 5,
            "umidade": 65,
            "temperatura": 22.3,
        },
        {
            "uid": "PLUVIOMETRO-001",
            "unixtime": 1702834800,
            "chuva_mm": 5,
            "umidade": 65,
            "temperatura": 22.3,
        },
        {
            "uid": "PLUVIOMETRO-001",
            "unixtime": 1702834900,
            "chuva_mm": 5,
            "umidade": 65,
            "temperatura": 500,
        },
    ]

    result = clean_measurements(raw, ProcessingConfig(null_strategy="keep_null"))

    assert result.total_received == 3
    assert result.total_valid == 1
    assert result.total_duplicates == 1
    assert result.total_rejected == 1
    assert list(result.clean_frame["temperatura"]) == [22.3]


def test_clean_measurements_normalizes_units() -> None:
    raw = [
        {
            "uid": "QUALIDADE_AR-001",
            "unixtime": 1702834800,
            "co2": 120,
            "pm25": -5,
            "qualidade_index": 4.7,
        }
    ]

    result = clean_measurements(raw, ProcessingConfig(null_strategy="keep_null"))

    row = result.clean_frame.iloc[0]
    assert row["co2"] == 200
    assert row["pm25"] == 0
    assert row["qualidade_index"] == 5


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