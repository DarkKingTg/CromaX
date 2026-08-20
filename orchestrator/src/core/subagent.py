# orchestrator/src/core/subagent.py
#
# Isolated subagent execution engine, ported from Claude Code & OpenHands subagent pattern.
# Spawns worker agents with scoped context windows to handle independent subtasks.

from dataclasses import dataclass
from typing import Any, Dict, List, Optional
from .events import AgentEvent, EventLog, EventType
from .workspace import Workspace
from ..llm.router import LLMRouter


@dataclass
class SubagentResult:
    subagent_id: str
    task: str
    success: bool
    summary: str
    events: List[AgentEvent]


class SubagentManager:
    def __init__(self, workspace: Workspace, router: LLMRouter) -> None:
        self.workspace = workspace
        self.router = router

    def spawn_worker(
        self,
        subagent_id: str,
        task_instruction: str,
        system_role: str = "You are an autonomous subagent focused on completing a scoped subtask.",
        mock_response: Optional[str] = None,
    ) -> SubagentResult:
        sub_log = EventLog()
        sub_log.append(
            AgentEvent(
                event_type=EventType.USER_MESSAGE,
                payload={"subagent_id": subagent_id, "instruction": task_instruction},
            )
        )

        messages = [
            {"role": "system", "content": system_role},
            {"role": "user", "content": task_instruction},
        ]

        resp = self.router.complete(
            messages=messages,
            reasoning_effort="high",
            mock_response=mock_response,
        )

        content = resp.get("content", "")
        sub_log.append(
            AgentEvent(
                event_type=EventType.AGENT_MESSAGE,
                payload={"subagent_id": subagent_id, "response": content},
            )
        )

        return SubagentResult(
            subagent_id=subagent_id,
            task=task_instruction,
            success=True,
            summary=content,
            events=sub_log.get_events(),
        )
