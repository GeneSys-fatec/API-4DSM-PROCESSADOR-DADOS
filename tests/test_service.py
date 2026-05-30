from __future__ import annotations

from unittest.mock import MagicMock, patch

import pandas as pd

from app.schemas import ProcessRequest
from app.service import _explode_measurements, build_mongo_filter, process_readings


def test_build_mongo_filter():
    req1 = ProcessRequest(
        tipos_sensores=["pluviometro"],
        data_inicio=100,
        data_fim=200,
        reprocessar_invalidas=False,
    )
    filter1 = build_mongo_filter(req1)
    assert filter1["uid"] == {"$regex": "PLUVIOMETRO"}
    assert filter1["unixtime"]["$gte"] == 100
    assert filter1["unixtime"]["$lte"] == 200
    assert filter1["_processada"] == {"$ne": True}

    req2 = ProcessRequest(uids=["UID-1"], reprocessar_invalidas=True)
    filter2 = build_mongo_filter(req2)
    assert filter2["uid"] == {"$in": ["UID-1"]}
    assert "unixtime" not in filter2
    assert "_processada" not in filter2


@patch("app.service.db")
@patch("app.service.clean_measurements")
@patch("app.service.trigger_alert_evaluation")
def test_process_readings_empty(mock_trigger, mock_clean, mock_db):
    mock_db.fetch_raw_readings.return_value = []
    req = ProcessRequest()
    outcome = process_readings(req)
    assert outcome.stats.total_processadas == 0


@patch("app.service.db")
@patch("app.service.clean_measurements")
@patch("app.service.trigger_alert_evaluation")
def test_process_readings_with_data(mock_trigger, mock_clean, mock_db):
    mock_db.fetch_raw_readings.return_value = [{"_id": "1", "uid": "UID-1", "unixtime": 1000}]

    clean_mock = MagicMock()
    clean_mock.clean_frame = pd.DataFrame(
        [
            {
                "_id": "1",
                "uid": "UID-1",
                "sensor_type": "pluviometro",
                "unixtime": 1000,
                "chuva_mm": 10,
            }
        ]
    )
    clean_mock.rejected_frame = pd.DataFrame()
    clean_mock.total_received = 1
    clean_mock.total_valid = 1
    clean_mock.total_rejected = 0
    clean_mock.total_duplicates = 0
    mock_clean.return_value = clean_mock

    mock_db.save_measurements.return_value = [
        ("UID-1", "pluviometro", 1, "chuva_mm", 10.0, 10.0, pd.Timestamp("2020-01-01T00:00:00Z"))
    ]

    req = ProcessRequest()
    outcome = process_readings(req)

    assert outcome.stats.total_validas == 1
    mock_trigger.assert_called_once_with(1, 10.0, pd.Timestamp("2020-01-01T00:00:00Z"))
    mock_db.delete_raw_sent.assert_called_once_with(["1"])


@patch("app.service.db")
@patch("app.service.clean_measurements")
def test_process_readings_delete_exception(mock_clean, mock_db):
    mock_db.fetch_raw_readings.return_value = [{"_id": "1"}]
    clean_mock = MagicMock()
    clean_mock.clean_frame = pd.DataFrame(
        [{"_id": "1", "uid": "UID-1", "sensor_type": "solo", "unixtime": 1000}]
    )
    clean_mock.rejected_frame = pd.DataFrame()
    clean_mock.total_received = 1
    clean_mock.total_valid = 1
    clean_mock.total_rejected = 0
    clean_mock.total_duplicates = 0
    mock_clean.return_value = clean_mock
    mock_db.save_measurements.return_value = []

    mock_db.delete_raw_sent.side_effect = Exception("delete error")

    req = ProcessRequest()
    outcome = process_readings(req)
    assert outcome.stats.total_validas == 1


def test_explode_measurements():
    df = pd.DataFrame(
        [
            {
                "_id": "1",
                "uid": "UID-1",
                "sensor_type": "pluviometro",
                "unixtime": 1000,
                "chuva_mm": 10,
            },
            {
                "_id": "2",
                "uid": "UID-1",
                "sensor_type": "pluviometro",
                "unixtime": 1001,
                "chuva_mm": None,
            },
        ]
    )
    res = _explode_measurements(df)
    assert len(res) == 1
    assert res.iloc[0]["parameter_name"] == "chuva_mm"
    assert res.iloc[0]["raw_value"] == 10


def test_explode_measurements_empty():
    res = _explode_measurements(pd.DataFrame())
    assert res.empty
