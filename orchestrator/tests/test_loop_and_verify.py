import sys
import tempfile
from pathlib import Path
from src.core.events import EventType
from src.core.loop import AgentSession, AgentSessionConfig
from src.core.verify import Verifier
from src.core.workspace import LocalWorkspace
from src.llm.router import LLMRouter
from src.memory.skills import SkillManager
from src.memory.store import MemoryStore


def test_agent_session_run_step_with_verification():
    with tempfile.TemporaryDirectory() as tmpdir:
        ws = LocalWorkspace(tmpdir)
        ws.write_file("calc.py", "def add(a, b):\n    return a + b\n")

        # Command that succeeds using current Python binary
        py_exe = sys.executable
        test_cmd = f'"{py_exe}" -c "from calc import add; assert add(2, 3) == 5"'

        config = AgentSessionConfig(
            session_id="test_session",
            test_command=test_cmd,
            auto_verify=True,
        )


        skill_mgr = SkillManager(Path(tmpdir) / "skills")
        memory_store = MemoryStore()

        session = AgentSession(
            workspace=ws,
            config=config,
            skill_manager=skill_mgr,
            memory_store=memory_store,
        )

        result = session.run_step(
            user_prompt="Please check add function in @file:calc.py",
            mock_response="The add function is verified and correct.",
        )

        assert result["verified"] is True
        assert result["verification"]["exit_code"] == 0
        assert result["response"] == "The add function is verified and correct."
        assert result["event_count"] >= 3
