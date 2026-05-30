from __future__ import annotations

import importlib
import sys
from datetime import timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

from app.db import Database, _column_exists, _decimal_or_none, _to_datetime


def test_decimal_or_none_returns_decimal_for_numeric_values() -> None:
    assert _decimal_or_none(4.01) == Decimal("4.01")


def test_decimal_or_none_returns_none_for_invalid_values() -> None:
    assert _decimal_or_none("4,01") is None
    assert _decimal_or_none(None) is None
    assert _decimal_or_none(pd.NA) is None


def test_to_datetime_without_tz():
    dt = _to_datetime("2020-01-01T00:00:00")
    assert dt.tzinfo == timezone.utc


def test_to_datetime_with_tz():
    dt = _to_datetime("2020-01-01T00:00:00+00:00")
    assert dt.tzinfo == timezone.utc


def test_column_exists():
    mock_cursor = MagicMock()
    mock_cursor.fetchone.return_value = [1]
    assert _column_exists(mock_cursor, "table", "col") is True

    mock_cursor.fetchone.return_value = None
    assert _column_exists(mock_cursor, "table", "col") is False


def test_db_close():
    db_inst = Database()
    db_inst.mongo_client = MagicMock()
    db_inst.postgres_conn = MagicMock()
    db_inst.close()
    assert db_inst.mongo_client is None
    assert db_inst.postgres_conn is None


@patch("app.db.MongoClient")
@patch("app.db.psycopg2")
@patch.object(Database, "ensure_schema")
def test_db_connect_success(mock_ensure_schema, mock_psycopg2, mock_mongo):
    with patch("app.db.settings.mongo_uri", "mock"), patch("app.db.settings.db_name", "mock"):
        db_inst = Database()
        db_inst.connect()
        assert db_inst.mongo_client is not None
        assert db_inst.postgres_conn is not None
        mock_ensure_schema.assert_called_once()


def test_db_connect_mongo_missing():
    db_inst = Database()
    with patch("app.db.MongoClient", None):
        with pytest.raises(RuntimeError, match="A biblioteca do MongoDB"):
            db_inst.connect()


def test_db_connect_mongo_uri_missing():
    db_inst = Database()
    with patch("app.db.MongoClient"):
        with patch("app.db.settings.mongo_uri", ""):
            with pytest.raises(RuntimeError, match="MONGO_URI não está configurado"):
                db_inst.connect()


def test_db_connect_postgres_missing():
    db_inst = Database()
    db_inst.mongo_client = MagicMock()
    with patch("app.db.psycopg2", None):
        with pytest.raises(RuntimeError, match="A biblioteca do PostgreSQL"):
            db_inst.connect()


def test_db_connect_postgres_dbname_missing():
    db_inst = Database()
    db_inst.mongo_client = MagicMock()
    with patch("app.db.psycopg2"):
        with patch("app.db.settings.db_name", ""):
            with pytest.raises(RuntimeError, match="DB_NAME não está configurado"):
                db_inst.connect()


def test_mongo_collection_unconnected():
    db_inst = Database()
    with pytest.raises(RuntimeError, match="MongoDB não conectado"):
        _ = db_inst.mongo_collection


def test_mongo_collection_connected():
    db_inst = Database()
    db_inst.mongo_client = MagicMock()
    col = db_inst.mongo_collection
    assert col is not None


def test_cursor_unconnected():
    db_inst = Database()
    with pytest.raises(RuntimeError, match="PostgreSQL não conectado"):
        with db_inst.cursor():
            pass


def test_cursor_connected():
    db_inst = Database()
    db_inst.postgres_conn = MagicMock()
    mock_cursor = MagicMock()
    db_inst.postgres_conn.cursor.return_value = mock_cursor
    with db_inst.cursor() as cur:
        assert cur is mock_cursor
    mock_cursor.close.assert_called_once()


def test_fetch_raw_readings():
    db_inst = Database()
    mock_col = MagicMock()
    mock_col.find().limit.return_value = [{"data": 1}]
    with patch.object(Database, "mongo_collection", mock_col):
        assert db_inst.fetch_raw_readings({}, 10) == [{"data": 1}]


def test_mark_raw_processed():
    db_inst = Database()
    mock_col = MagicMock()
    with patch.object(Database, "mongo_collection", mock_col):
        db_inst.mark_raw_processed([])
        mock_col.update_many.assert_not_called()
        db_inst.mark_raw_processed(["id1"])
        mock_col.update_many.assert_called_once()


def test_delete_raw_sent():
    db_inst = Database()
    mock_col = MagicMock()
    with patch.object(Database, "mongo_collection", mock_col):
        db_inst.delete_raw_sent([])
        mock_col.delete_many.assert_not_called()
        db_inst.delete_raw_sent(["id1"])
        mock_col.delete_many.assert_called_once()


def test_save_measurements_empty():
    db_inst = Database()
    assert db_inst.save_measurements(pd.DataFrame()) == []


@patch("app.db.execute_values")
def test_save_measurements_data(mock_execute_values):
    db_inst = Database()
    db_inst.postgres_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.fetchall.return_value = [("UID-1", "chuva_mm", 10), ("PREFIX", "temp", 20)]

    df = pd.DataFrame(
        [
            {
                "sensor_uid": "UID-1",
                "parameter_name": "chuva_mm",
                "sensor_type": "pluviometro",
                "raw_value": 5,
                "value": 5,
                "collected_at": pd.Timestamp("2020-01-01T00:00:00Z"),
            },
            {
                "sensor_uid": "PREFIX-2",
                "parameter_name": "temp",
                "sensor_type": "solo",
                "raw_value": None,
                "value": 15,
                "collected_at": pd.Timestamp("2020-01-01T00:00:00Z"),
            },
        ]
    )

    with patch.object(Database, "cursor") as mock_cursor_cm:
        mock_cursor_cm.return_value.__enter__.return_value = mock_cursor
        records = db_inst.save_measurements(df)
        assert len(records) == 2
        assert records[0][2] == 10
        assert records[1][2] == 20


def test_ensure_schema():
    db_inst = Database()
    mock_cursor = MagicMock()

    with patch("app.db._column_exists", side_effect=[True, False]):
        with patch.object(Database, "cursor") as mock_cursor_cm:
            mock_cursor_cm.return_value.__enter__.return_value = mock_cursor
            db_inst.ensure_schema()
            assert mock_cursor.execute.call_count > 0


def test_ensure_measurements_compatibility():
    db_inst = Database()
    mock_cursor = MagicMock()
    with patch("app.db._column_exists", side_effect=[True, False]):
        db_inst._ensure_measurements_compatibility(mock_cursor)
        mock_cursor.execute.assert_any_call(
            "ALTER TABLE measurements RENAME COLUMN uid TO sensor_uid"
        )


def test_ensure_measurements_conflict_target():
    db_inst = Database()
    mock_cursor = MagicMock()
    db_inst._ensure_measurements_conflict_target(mock_cursor)
    mock_cursor.execute.assert_called_once()


def test_import_failures():
    import app.db

    with patch.dict(sys.modules, {"psycopg2": None, "psycopg2.extras": None, "pymongo": None}):
        importlib.reload(app.db)
        assert app.db.psycopg2 is None
        assert app.db.MongoClient is None

    importlib.reload(app.db)
