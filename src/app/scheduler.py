from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from .config import settings
from .schemas import ProcessRequest, SchedulerStatus
from .service import process_readings

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class SchedulerState:
    running: bool = False
    last_run: datetime | None = None
    next_run: datetime | None = None


class ProcessingScheduler:
    def __init__(self, interval_ms: int) -> None:
        self.interval_ms = interval_ms
        self.state = SchedulerState()
        self._scheduler: AsyncIOScheduler | None = None
        self._job_id = "processing_job"
        self._request = ProcessRequest()

    async def start(self, request: ProcessRequest | None = None) -> None:
        if self.state.running:
            return

        self._request = request or ProcessRequest()
        interval_seconds = max(1, self.interval_ms // 1000)

        self._scheduler = AsyncIOScheduler()

        async def _job(args_request: ProcessRequest) -> None:
            try:
                await asyncio.to_thread(process_readings, args_request)
                now = datetime.now(timezone.utc)
                self.state.last_run = now
                self.state.next_run = now
            except Exception:
                logger.exception("Falha no scheduler")

        self._scheduler.add_job(
            _job,
            trigger=IntervalTrigger(seconds=interval_seconds),
            args=[self._request],
            id=self._job_id,
            replace_existing=True,
        )
        self._scheduler.start()
        self.state.running = True

    async def stop(self) -> None:
        if not self.state.running or self._scheduler is None:
            return
        try:
            self._scheduler.remove_all_jobs()
            self._scheduler.shutdown(wait=False)
        finally:
            self._scheduler = None
            self.state = SchedulerState()

    async def restart(self) -> None:
        await self.stop()
        await self.start(self._request)

    def snapshot(self) -> SchedulerStatus:
        return SchedulerStatus(
            rodando=self.state.running,
            ultima_execucao=self.state.last_run.isoformat() if self.state.last_run else None,
            proxima_execucao=self.state.next_run.isoformat() if self.state.next_run else None,
        )

    async def run_once(self, request: ProcessRequest | None = None) -> None:
        await asyncio.to_thread(process_readings, request or self._request)


scheduler = ProcessingScheduler(interval_ms=settings.scheduler_interval_ms)
