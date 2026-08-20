# orchestrator/src/gateway/scheduler.py
#
# Background cron and heartbeat task scheduler, ported from OpenClaw automation engine.

import time
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional


@dataclass
class ScheduledTask:
    task_id: str
    interval_seconds: int
    action: Callable[[], Any]
    last_run_timestamp: float = 0.0
    is_active: bool = True


class BackgroundScheduler:
    def __init__(self) -> None:
        self.tasks: Dict[str, ScheduledTask] = {}

    def schedule(
        self, task_id: str, interval_seconds: int, action: Callable[[], Any]
    ) -> None:
        self.tasks[task_id] = ScheduledTask(
            task_id=task_id,
            interval_seconds=interval_seconds,
            action=action,
            last_run_timestamp=time.time(),
            is_active=True,
        )

    def cancel(self, task_id: str) -> bool:
        if task_id in self.tasks:
            self.tasks[task_id].is_active = False
            return True
        return False

    def tick(self) -> List[str]:
        """Runs due tasks and returns list of executed task IDs."""
        now = time.time()
        executed = []
        for task in self.tasks.values():
            if task.is_active and (now - task.last_run_timestamp) >= task.interval_seconds:
                try:
                    task.action()
                    task.last_run_timestamp = now
                    executed.append(task.task_id)
                except Exception:
                    pass
        return executed
