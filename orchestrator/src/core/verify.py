# orchestrator/src/core/verify.py
#
# SWE-bench style verification runner (Jimenez et al., 2024).
# Validates code changes by executing real build/test commands and inspecting process exit codes.

import re
from dataclasses import dataclass
from typing import List, Optional
from .workspace import Workspace, CommandResult


@dataclass
class VerificationResult:
    command: str
    passed: bool
    exit_code: int
    output: str
    failure_reasons: List[str]


class Verifier:
    """Executes verification commands inside a Workspace to validate task correctness."""

    def __init__(self, workspace: Workspace) -> None:
        self.workspace = workspace

    def verify_command(
        self, test_command: str, timeout_seconds: int = 120
    ) -> VerificationResult:
        res: CommandResult = self.workspace.run_command(
            test_command, timeout_seconds=timeout_seconds
        )

        failure_reasons: List[str] = []
        full_output = f"{res.stdout}\n{res.stderr}".strip()

        if res.exit_code != 0:
            failure_reasons.append(f"Command exited with non-zero code {res.exit_code}")

            # Extract syntax or assertion error hints
            for line in full_output.splitlines():
                if any(
                    err_kw in line.lower()
                    for err_kw in [
                        "error:",
                        "failed",
                        "assertionerror",
                        "syntaxerror",
                        "typeerror",
                    ]
                ):
                    failure_reasons.append(line.strip())

        return VerificationResult(
            command=test_command,
            passed=(res.exit_code == 0),
            exit_code=res.exit_code,
            output=full_output,
            failure_reasons=failure_reasons[:10],
        )
