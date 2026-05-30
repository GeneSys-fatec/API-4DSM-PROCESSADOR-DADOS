from __future__ import annotations

import logging
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import requests

logger = logging.getLogger(__name__)

API_URL = os.getenv("NODE_API_URL", "http://localhost:3333")

_executor = ThreadPoolExecutor(max_workers=5)


def _send_alert_evaluation(parameter_id: int, value: float, collected_at: datetime) -> None:
    try:
        payload = {
            "parameterId": parameter_id,
            "measuredValue": float(value),
            "occurredAt": collected_at.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
        }

        requests.post(f"{API_URL}/alerts/evaluate", json=payload, timeout=2.0)
    except Exception as e:
        logger.warning("Aviso: Falha ao notificar API de alertas: %s", e)


def trigger_alert_evaluation(parameter_id: int, value: float, collected_at: datetime) -> None:
    _executor.submit(_send_alert_evaluation, parameter_id, value, collected_at)
