import pytest
from src.core.events import AgentEvent, EventLog, EventType


def test_event_log_append_and_replay():
    log = EventLog()
    event1 = AgentEvent(
        event_type=EventType.USER_MESSAGE,
        payload={"prompt": "Refactor auth module"},
    )
    event2 = AgentEvent(
        event_type=EventType.ACTION,
        payload={"tool": "write_file", "file_path": "src/auth.py"},
    )

    log.append(event1)
    log.append(event2)

    events = log.replay()
    assert len(events) == 2
    assert events[0].event_type == EventType.USER_MESSAGE
    assert events[1].event_type == EventType.ACTION
    assert events[1].payload["file_path"] == "src/auth.py"


def test_event_log_json_serialization():
    log = EventLog()
    log.append(
        AgentEvent(
            event_type=EventType.OBSERVATION,
            payload={"summary": "File saved"},
        )
    )

    json_str = log.to_json()
    reconstructed = EventLog.from_json(json_str)

    assert len(reconstructed.get_events()) == 1
    assert reconstructed.get_events()[0].event_type == EventType.OBSERVATION
    assert reconstructed.get_events()[0].payload["summary"] == "File saved"


def test_event_log_state_summary():
    log = EventLog()
    log.append(
        AgentEvent(
            event_type=EventType.ACTION,
            payload={"tool": "write_file", "file_path": "a.py"},
        )
    )
    log.append(
        AgentEvent(
            event_type=EventType.ACTION,
            payload={"tool": "write_file", "file_path": "b.py"},
        )
    )

    summary = log.summarize_state()
    assert summary["actions_executed"] == 2
    assert set(summary["files_touched"]) == {"a.py", "b.py"}
