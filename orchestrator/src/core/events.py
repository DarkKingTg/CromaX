# orchestrator/src/core/events.py
#
# Event-sourced state model, ported from OpenHands Agent SDK V1 architecture (arXiv:2511.03690).
# Every action, observation, message, and compaction is recorded as an immutable event.

import json
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional


class EventType(str, Enum):
    USER_MESSAGE = "user_message"
    AGENT_MESSAGE = "agent_message"
    ACTION = "action"
    OBSERVATION = "observation"
    CONDENSATION = "condensation"
    VERIFICATION = "verification"
    SKILL_SAVED = "skill_saved"
    ERROR = "error"


@dataclass(frozen=True)
class AgentEvent:
    event_type: EventType
    payload: Dict[str, Any]
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_id": self.event_id,
            "event_type": self.event_type.value,
            "payload": self.payload,
            "timestamp": self.timestamp,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AgentEvent":
        return cls(
            event_id=data["event_id"],
            event_type=EventType(data["event_type"]),
            payload=data["payload"],
            timestamp=data["timestamp"],
        )


class EventLog:
    """Append-only event log. Replaying this log end-to-end reconstructs
    the exact session state.
    """

    def __init__(self) -> None:
        self._events: List[AgentEvent] = []

    def append(self, event: AgentEvent) -> None:
        self._events.append(event)

    def get_events(self) -> List[AgentEvent]:
        return list(self._events)

    def replay(self) -> List[AgentEvent]:
        return list(self._events)

    def to_json(self) -> str:
        return json.dumps([e.to_dict() for e in self._events], indent=2)

    @classmethod
    def from_json(cls, json_str: str) -> "EventLog":
        log = cls()
        data = json.loads(json_str)
        for item in data:
            log.append(AgentEvent.from_dict(item))
        return log

    def summarize_state(self) -> Dict[str, Any]:
        """Reconstructs high-level state from events."""
        actions_count = sum(1 for e in self._events if e.event_type == EventType.ACTION)
        observations_count = sum(
            1 for e in self._events if e.event_type == EventType.OBSERVATION
        )
        modified_files = set()
        for e in self._events:
            if e.event_type == EventType.ACTION and "file_path" in e.payload:
                modified_files.add(e.payload["file_path"])

        return {
            "total_events": len(self._events),
            "actions_executed": actions_count,
            "observations_recorded": observations_count,
            "files_touched": list(modified_files),
        }
