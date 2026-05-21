from __future__ import annotations

from dataclasses import dataclass
from os import getenv

try:
    from dotenv import load_dotenv

    load_dotenv()
except Exception:
    pass


@dataclass(slots=True)
class Settings:
    mongo_uri: str = getenv("MONGO_URI", "")
    mongo_db_name: str = getenv("MONGO_DB_NAME", "sensor_data")
    mongo_collection_name: str = getenv("MONGO_COLLECTION_NAME", "leituras")

    db_host: str = getenv("DB_HOST", "localhost")
    db_port: int = int(getenv("DB_PORT", "5432"))
    db_user: str = getenv("DB_USERNAME", "postgres")
    db_password: str = getenv("DB_PASSWORD", "")
    db_name: str = getenv("DB_NAME", getenv("DB_DATABASE", ""))

    port: int = int(getenv("PORT", "3005"))
    host: str = getenv("HOST", "0.0.0.0")
    scheduler_enable: bool = getenv("SCHEDULER_ENABLE", "true").lower() == "true"
    scheduler_interval_ms: int = int(getenv("SCHEDULER_INTERVAL_MS", "120000"))


settings = Settings()
