from __future__ import annotations

from sensor_processor.cleaning import clean_measurements
from sensor_processor.models import ProcessingConfig


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
