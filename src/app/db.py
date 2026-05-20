from __future__ import annotations

import logging
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Iterator

import pandas as pd
try:
    import psycopg2
    from psycopg2.extras import execute_values
except Exception:
    psycopg2 = None
    execute_values = None
try:
    from pymongo import MongoClient
except Exception:
    MongoClient = None

from .config import settings

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class Database:
    mongo_client: MongoClient | None = None
    postgres_conn: psycopg2.extensions.connection | None = None

    def connect(self) -> None:
        if self.mongo_client is None:
            if MongoClient is None:
                raise RuntimeError("A biblioteca do MongoDB não está instalada")
            if not settings.mongo_uri:
                raise RuntimeError("MONGO_URI não está configurado")

            mongo_client = MongoClient(
                settings.mongo_uri,
                tls=True,
                tlsInsecure=True,
                maxPoolSize=10,
                serverSelectionTimeoutMS=30_000,
                connectTimeoutMS=30_000,
                socketTimeoutMS=30_000,
            )
            mongo_client.admin.command("ping")
            self.mongo_client = mongo_client

        if self.postgres_conn is None:
            if psycopg2 is None:
                raise RuntimeError("A biblioteca do PostgreSQL não está instalada")
            if not settings.db_name:
                raise RuntimeError("DB_NAME não está configurado")

            postgres_conn = psycopg2.connect(
                host=settings.db_host,
                port=settings.db_port,
                user=settings.db_user,
                password=settings.db_password,
                dbname=settings.db_name,
            )
            postgres_conn.autocommit = True
            self.postgres_conn = postgres_conn

        self.ensure_schema()

    def close(self) -> None:
        if self.mongo_client is not None:
            self.mongo_client.close()
            self.mongo_client = None

        if self.postgres_conn is not None:
            self.postgres_conn.close()
            self.postgres_conn = None

    @property
    def mongo_collection(self):
        if self.mongo_client is None:
            raise RuntimeError("MongoDB não conectado")
        return self.mongo_client[settings.mongo_db_name][settings.mongo_collection_name]

    @contextmanager
    def cursor(self) -> Iterator[psycopg2.extensions.cursor]:
        if self.postgres_conn is None:
            raise RuntimeError("PostgreSQL não conectado")
        cursor = self.postgres_conn.cursor()
        try:
            yield cursor
        finally:
            cursor.close()

    def ensure_schema(self) -> None:
        statements = [
            """
            CREATE TABLE IF NOT EXISTS measurements (
                id BIGSERIAL PRIMARY KEY,
                sensor_uid TEXT NOT NULL,
                sensor_type TEXT NOT NULL,
                parameter_name TEXT NOT NULL,
                raw_value NUMERIC(14, 4),
                value NUMERIC(14, 4),
                collected_at TIMESTAMPTZ NOT NULL,
                received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE (sensor_uid, parameter_name, collected_at)
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS alert_logs (
                id BIGSERIAL PRIMARY KEY,
                id_start_rule INTEGER,
                login TEXT NOT NULL DEFAULT 'system',
                text TEXT,
                triggered_value TEXT,
                triggered_at TIMESTAMPTZ,
                received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                status TEXT NOT NULL DEFAULT 'alert_status_error'
            )
            """,
        ]

        with self.cursor() as cursor:
            for statement in statements:
                cursor.execute(statement)
            self._ensure_measurements_compatibility(cursor)
            self._ensure_measurements_conflict_target(cursor)

    def _ensure_measurements_compatibility(self, cursor) -> None:
        if _column_exists(cursor, "measurements", "uid") and not _column_exists(cursor, "measurements", "sensor_uid"):
            cursor.execute("ALTER TABLE measurements RENAME COLUMN uid TO sensor_uid")

        statements = [
            "ALTER TABLE measurements ADD COLUMN IF NOT EXISTS sensor_uid TEXT",
            "ALTER TABLE measurements ADD COLUMN IF NOT EXISTS sensor_type TEXT",
            "ALTER TABLE measurements ADD COLUMN IF NOT EXISTS id_parameter INTEGER",
            "ALTER TABLE measurements ADD COLUMN IF NOT EXISTS parameter_name TEXT",
            "ALTER TABLE measurements ADD COLUMN IF NOT EXISTS raw_value NUMERIC(14, 4)",
            "ALTER TABLE measurements ADD COLUMN IF NOT EXISTS value NUMERIC(14, 4)",
            "ALTER TABLE measurements ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ",
            "ALTER TABLE measurements ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
        ]
        for statement in statements:
            cursor.execute(statement)

    def _ensure_measurements_conflict_target(self, cursor) -> None:
        cursor.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS measurements_unique_sensor_parameter_collected_at
            ON measurements (sensor_uid, parameter_name, collected_at)
            """
        )

    def fetch_raw_readings(self, mongo_filter: dict, limit: int) -> list[dict]:
        cursor = self.mongo_collection.find(mongo_filter).limit(limit)
        return list(cursor)

    def mark_raw_processed(self, raw_ids: list[object]) -> None:
        if not raw_ids:
            return
        self.mongo_collection.update_many({"_id": {"$in": raw_ids}}, {"$set": {"_processada": True}})

    def delete_raw_sent(self, raw_ids: list[object]) -> None:
        if not raw_ids:
            return
        self.mongo_collection.delete_many({"_id": {"$in": raw_ids}})

    def save_measurements(self, frame: pd.DataFrame) -> int:
        if frame.empty:
            return 0

        mapping = {}
        fallback_mapping = {}
        with self.cursor() as cursor:
            cursor.execute("""
                SELECT s."idDatalogger", pt.json_key, p.id
                FROM parameters p
                JOIN stations s ON p."idStation" = s.id
                JOIN "parameterTypes" pt ON p."idTypeParam" = pt.id
            """)
            for station_uid, param_key, param_id in cursor.fetchall():
                mapping[(station_uid, param_key)] = param_id
                
                prefix = station_uid.split('-')[0]
                fallback_mapping[(prefix, param_key)] = param_id

        records = []
        for row in frame.to_dict(orient="records"):
            sensor_uid = row["sensor_uid"]
            param_name = row["parameter_name"]
            
            real_param_id = mapping.get((sensor_uid, param_name))
            if real_param_id is None:
                prefix = sensor_uid.split('-')[0]
                real_param_id = fallback_mapping.get((prefix, param_name))

            records.append(
                (
                    sensor_uid,
                    row["sensor_type"],
                    real_param_id,  
                    param_name,
                    _decimal_or_none(row.get("raw_value")),
                    _decimal_or_none(row.get("value")),
                    _to_datetime(row["collected_at"]),
                )
            )

        statement = """
            INSERT INTO measurements (
                sensor_uid,
                sensor_type,
                id_parameter,
                parameter_name,
                raw_value,
                value,
                collected_at
            ) VALUES %s
            ON CONFLICT (sensor_uid, parameter_name, collected_at)
            DO UPDATE SET
                id_parameter = EXCLUDED.id_parameter,
                raw_value = EXCLUDED.raw_value,
                value = EXCLUDED.value,
                sensor_type = EXCLUDED.sensor_type
        """

        with self.cursor() as cursor:
            execute_values(cursor, statement, records, page_size=500)
        return len(records)

def _decimal_or_none(value: object) -> Decimal | None:
    if value is None or pd.isna(value):
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        logger.warning("Ignorando valor decimal inválido: %r", value)
        return None


def _to_datetime(value: object) -> datetime:
    timestamp = pd.Timestamp(value)
    if timestamp.tzinfo is None:
        timestamp = timestamp.tz_localize(timezone.utc)
    return timestamp.to_pydatetime()


def _column_exists(cursor, table_name: str, column_name: str) -> bool:
    cursor.execute(
        """
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = %s AND column_name = %s
        """,
        (table_name, column_name),
    )
    return cursor.fetchone() is not None

db = Database()