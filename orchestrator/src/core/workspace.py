# orchestrator/src/core/workspace.py
#
# Workspace execution abstraction, ported from OpenHands Workspace design pattern.
# Decouples agent logic from the execution environment (LocalWorkspace vs Docker/Remote).

import abc
import os
import shlex
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional


@dataclass
class CommandResult:
    exit_code: int
    stdout: str
    stderr: str
    duration_ms: float

    @property
    def success(self) -> bool:
        return self.exit_code == 0


class Workspace(abc.ABC):
    @abc.abstractmethod
    def read_file(self, rel_path: str) -> str:
        pass

    @abc.abstractmethod
    def write_file(self, rel_path: str, content: str) -> None:
        pass

    @abc.abstractmethod
    def file_exists(self, rel_path: str) -> bool:
        pass

    @abc.abstractmethod
    def list_dir(self, rel_path: str = "") -> List[str]:
        pass

    @abc.abstractmethod
    def run_command(self, command: str, timeout_seconds: int = 60) -> CommandResult:
        pass


class LocalWorkspace(Workspace):
    """Local file-system and subprocess workspace for development and testing."""

    def __init__(self, root_dir: str | Path) -> None:
        self.root = Path(root_dir).resolve()
        if not self.root.exists():
            self.root.mkdir(parents=True, exist_ok=True)

    def _resolve_path(self, rel_path: str) -> Path:
        target = (self.root / rel_path).resolve()
        try:
            target.relative_to(self.root)
        except ValueError:
            raise ValueError(f"Path traversal detected outside workspace: {rel_path}")
        return target

    def read_file(self, rel_path: str) -> str:
        target = self._resolve_path(rel_path)
        with open(target, "r", encoding="utf-8", errors="replace") as f:
            return f.read()

    def write_file(self, rel_path: str, content: str) -> None:
        target = self._resolve_path(rel_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        with open(target, "w", encoding="utf-8") as f:
            f.write(content)

    def file_exists(self, rel_path: str) -> bool:
        try:
            target = self._resolve_path(rel_path)
            return target.exists() and target.is_file()
        except ValueError:
            return False

    def list_dir(self, rel_path: str = "") -> List[str]:
        target = self._resolve_path(rel_path)
        if not target.is_dir():
            return []
        return [p.name for p in target.iterdir()]

    def run_command(self, command: str, timeout_seconds: int = 60) -> CommandResult:
        start_time = time.time()
        try:
            cmd_args = shlex.split(command, posix=os.name != "nt") if isinstance(command, str) else command
            proc = subprocess.run(
                cmd_args,
                cwd=str(self.root),
                shell=False,
                capture_output=True,
                text=True,
                timeout=timeout_seconds,
            )
            duration_ms = (time.time() - start_time) * 1000.0
            return CommandResult(
                exit_code=proc.returncode,
                stdout=proc.stdout,
                stderr=proc.stderr,
                duration_ms=duration_ms,
            )
        except subprocess.TimeoutExpired as e:
            duration_ms = (time.time() - start_time) * 1000.0
            return CommandResult(
                exit_code=-1,
                stdout=e.stdout or "" if isinstance(e.stdout, str) else "",
                stderr=f"Command timed out after {timeout_seconds}s",
                duration_ms=duration_ms,
            )
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000.0
            return CommandResult(
                exit_code=-1,
                stdout="",
                stderr=str(e),
                duration_ms=duration_ms,
            )
