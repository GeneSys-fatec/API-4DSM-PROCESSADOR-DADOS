from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.api import app, shutdown, startup
from app.schemas import ProcessingStats

client = TestClient(app)


@pytest.mark.asyncio
@patch("app.api.db")
@patch("app.api.scheduler")
@patch("app.api.settings")
async def test_startup(mock_settings, mock_scheduler, mock_db):
    mock_settings.scheduler_enable = True
    mock_scheduler.start = AsyncMock()
    await startup()
    mock_db.connect.assert_called_once()
    mock_scheduler.start.assert_called_once()


@pytest.mark.asyncio
@patch("app.api.db")
@patch("app.api.scheduler")
async def test_shutdown(mock_scheduler, mock_db):
    mock_scheduler.stop = AsyncMock()
    await shutdown()
    mock_scheduler.stop.assert_called_once()
    mock_db.close.assert_called_once()


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@patch("app.api.process_readings")
def test_process_endpoint_success(mock_process_readings):
    mock_process_readings.return_value.stats = ProcessingStats(
        total_processadas=1,
        total_validas=1,
        total_rejeitadas=0,
        total_interpoladas=0,
        total_duplicatas=0,
        total_agregadas=0,
        tempo_ms=10,
    )
    response = client.post("/processar", json={})
    assert response.status_code == 200
    assert response.json()["sucesso"] is True


@patch("app.api.process_readings", side_effect=ValueError("Test Error"))
def test_process_endpoint_error(mock_process_readings):
    response = client.post("/processar", json={})
    assert response.status_code == 500
    assert "Test Error" in response.json()["detail"]


@patch("app.api.scheduler.start", new_callable=AsyncMock)
@patch("app.api.scheduler.snapshot")
def test_start_scheduler(mock_snapshot, mock_start):
    mock_snapshot.return_value = {"rodando": True}
    response = client.post("/scheduler/iniciar", json={})
    assert response.status_code == 200
    mock_start.assert_called_once()


@patch("app.api.scheduler.stop", new_callable=AsyncMock)
@patch("app.api.scheduler.snapshot")
def test_stop_scheduler(mock_snapshot, mock_stop):
    mock_snapshot.return_value = {"rodando": False}
    response = client.post("/scheduler/parar")
    assert response.status_code == 200
    mock_stop.assert_called_once()


@patch("app.api.scheduler.restart", new_callable=AsyncMock)
@patch("app.api.scheduler.snapshot")
def test_restart_scheduler(mock_snapshot, mock_restart):
    mock_snapshot.return_value = {"rodando": True}
    response = client.post("/scheduler/reiniciar")
    assert response.status_code == 200
    mock_restart.assert_called_once()


@patch("app.api.scheduler.snapshot")
def test_scheduler_status(mock_snapshot):
    mock_snapshot.return_value = {"rodando": True}
    response = client.get("/scheduler/status")
    assert response.status_code == 200
