from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.scheduler import ProcessingScheduler
from app.schemas import ProcessRequest


@pytest.mark.asyncio
async def test_scheduler_start_and_stop():
    scheduler = ProcessingScheduler(interval_ms=1000)
    assert not scheduler.state.running
    
    await scheduler.start()
    assert scheduler.state.running
    
    with patch("app.scheduler.AsyncIOScheduler") as mock_cls:
        await scheduler.start()
        mock_cls.assert_not_called()
    
    status = scheduler.snapshot()
    assert status.rodando is True
    
    await scheduler.stop()
    assert not scheduler.state.running
    
    await scheduler.stop()

@pytest.mark.asyncio
async def test_scheduler_restart():
    scheduler = ProcessingScheduler(interval_ms=1000)
    await scheduler.restart()
    assert scheduler.state.running
    await scheduler.stop()

@pytest.mark.asyncio
@patch("app.scheduler.process_readings")
async def test_scheduler_run_once(mock_process):
    scheduler = ProcessingScheduler(interval_ms=1000)
    await scheduler.run_once()
    mock_process.assert_called_once()

@pytest.mark.asyncio
@patch("app.scheduler.AsyncIOScheduler")
async def test_scheduler_job(mock_scheduler_class):
    mock_scheduler = MagicMock()
    mock_scheduler_class.return_value = mock_scheduler
    
    scheduler = ProcessingScheduler(interval_ms=1000)
    await scheduler.start()
    
    add_job_call = mock_scheduler.add_job.call_args
    job_func = add_job_call[0][0]
    
    with patch("app.scheduler.process_readings") as mock_process:
        await job_func(ProcessRequest())
        mock_process.assert_called_once()
        assert scheduler.state.last_run is not None
        assert scheduler.state.next_run is not None
        
    with patch("app.scheduler.process_readings", side_effect=Exception("Error")):
        with patch("app.scheduler.logger.exception") as mock_logger:
            await job_func(ProcessRequest())
            mock_logger.assert_called_once()