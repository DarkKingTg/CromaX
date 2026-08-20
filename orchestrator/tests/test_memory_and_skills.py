import tempfile
from pathlib import Path
from src.core.events import AgentEvent, EventLog, EventType
from src.memory.skills import SkillManager
from src.memory.store import MemoryStore
from src.skills.creator import SkillSynthesizer


def test_memory_store_fts5():
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test_memory.db"
        store = MemoryStore(db_path)

        store.save_session_memory(
            session_id="sess_1",
            summary="Refactored database connection pool with asyncpg",
            tags="database,asyncpg,refactor",
        )
        store.save_session_memory(
            session_id="sess_2",
            summary="Added JWT authentication middleware",
            tags="auth,jwt,security",
        )

        results = store.search_memories("database connection")
        assert len(results) >= 1
        assert "asyncpg" in results[0].summary


def test_skill_manager_and_synthesizer():
    with tempfile.TemporaryDirectory() as tmpdir:
        skills_dir = Path(tmpdir) / "skills"
        skill_mgr = SkillManager(skills_dir)
        store = MemoryStore()

        skill = skill_mgr.create_skill(
            name="auth-refactor",
            description="Steps for refactoring auth tokens",
            tags=["auth", "jwt"],
            instructions="1. Check token expiry\n2. Verify signature",
        )

        loaded_skills = skill_mgr.load_all_skills()
        assert len(loaded_skills) == 1
        assert loaded_skills[0].name == "auth-refactor"

        applicable = skill_mgr.find_applicable_skills("Please help with auth tokens")
        assert len(applicable) == 1
        assert applicable[0].name == "auth-refactor"

        # Test synthesizer trigger check
        synthesizer = SkillSynthesizer(skill_mgr, store)
        log = EventLog()
        log.append(
            AgentEvent(
                event_type=EventType.ACTION,
                payload={"tool": "write_file", "details": "updated auth.py"},
            )
        )
        log.append(
            AgentEvent(
                event_type=EventType.ACTION,
                payload={"tool": "write_file", "details": "updated test_auth.py"},
            )
        )
        log.append(
            AgentEvent(
                event_type=EventType.VERIFICATION,
                payload={"command": "pytest", "passed": True},
            )
        )

        assert synthesizer.should_synthesize_skill(log) is True

        mock_skill_doc = (
            "---\n"
            "name: \"jwt-renewal-pattern\"\n"
            "description: \"How to renew expired JWT tokens\"\n"
            "tags: [\"jwt\", \"auth\"]\n"
            "created_at: \"2026-08-19T00:00:00Z\"\n"
            "---\n\n"
            "# JWT Renewal\n"
            "1. Decode token payload."
        )

        created = synthesizer.synthesize_from_session(
            session_id="sess_123",
            task_prompt="Implement JWT renewal",
            event_log=log,
            mock_output=mock_skill_doc,
        )

        assert created is not None
        assert created.name == "jwt-renewal-pattern"
        assert len(skill_mgr.load_all_skills()) == 2
