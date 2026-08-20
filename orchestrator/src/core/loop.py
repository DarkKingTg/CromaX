# orchestrator/src/core/loop.py
#
# Core agent execution loop with event-sourcing and context compaction hooks.
# Ported from Claude Code (compaction hooks) and OpenHands (event-driven loop).

import json
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional
from .events import AgentEvent, EventLog, EventType
from .verify import Verifier, VerificationResult
from .workspace import Workspace
from ..context.mentions import ContextExpander
from ..context.repomap_client import RepoMapClient
from ..llm.router import LLMRouter
from ..memory.skills import SkillManager
from ..memory.store import MemoryStore
from ..skills.creator import SkillSynthesizer


@dataclass
class AgentSessionConfig:
    session_id: str
    max_steps: int = 20
    compaction_threshold_events: int = 15
    auto_verify: bool = True
    test_command: Optional[str] = None
    token_budget: int = 4096


class AgentSession:
    def __init__(
        self,
        workspace: Workspace,
        config: AgentSessionConfig,
        router: Optional[LLMRouter] = None,
        memory_store: Optional[MemoryStore] = None,
        skill_manager: Optional[SkillManager] = None,
        repomap_client: Optional[RepoMapClient] = None,
    ) -> None:
        self.workspace = workspace
        self.config = config
        self.router = router or LLMRouter()
        self.memory_store = memory_store or MemoryStore()
        self.skill_manager = skill_manager
        self.repomap_client = repomap_client or RepoMapClient()
        self.expander = ContextExpander(workspace)
        self.verifier = Verifier(workspace)
        self.event_log = EventLog()
        self.synthesizer = (
            SkillSynthesizer(self.skill_manager, self.memory_store, self.router)
            if self.skill_manager
            else None
        )

        # Hooks
        self.pre_compact_hooks: List[Callable[[EventLog], Dict[str, Any]]] = [
            self._default_pre_compact
        ]
        self.post_compact_hooks: List[Callable[[Dict[str, Any], List[Dict[str, str]]], None]] = [
            self._default_post_compact
        ]

    def _default_pre_compact(self, log: EventLog) -> Dict[str, Any]:
        """Captures critical state that must survive context window compaction."""
        summary = log.summarize_state()
        return {
            "files_touched": summary["files_touched"],
            "total_actions": summary["actions_executed"],
        }

    def _default_post_compact(
        self, preserved_state: Dict[str, Any], messages: List[Dict[str, str]]
    ) -> None:
        """Injects preserved state back into the freshly compacted message history."""
        files = preserved_state.get("files_touched", [])
        if files:
            messages.append(
                {
                    "role": "system",
                    "content": f"[Context Compaction Notice]: Preserved state from earlier turns:\n- Modified files: {', '.join(files)}",
                }
            )

    def run_step(
        self,
        user_prompt: str,
        active_files: Optional[List[str]] = None,
        mock_response: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Executes an agent task cycle."""
        # 1. Log incoming user message
        self.event_log.append(
            AgentEvent(
                event_type=EventType.USER_MESSAGE,
                payload={"prompt": user_prompt, "active_files": active_files or []},
            )
        )

        # 2. Context retrieval & expansion
        expanded_mentions = self.expander.extract_and_expand(user_prompt)
        repo_map_data = self.repomap_client.get_repo_map(
            workspace_root=getattr(self.workspace, "root", "."),
            token_budget=self.config.token_budget,
            active_files=active_files,
        )

        # 3. Retrieve relevant skills & memories
        applicable_skills = (
            self.skill_manager.find_applicable_skills(user_prompt)
            if self.skill_manager
            else []
        )
        memories = self.memory_store.search_memories(user_prompt, limit=3)

        # 4. Construct messages
        system_prompt = (
            "You are CromaX, an expert AI pair programmer for deep multi-file refactoring.\n"
            "Ground your answers in the codebase graph and verification tests."
        )

        context_blocks = []
        if repo_map_data.get("formatted_map"):
            context_blocks.append(f"### Codebase Symbol Map\n{repo_map_data['formatted_map']}")

        if applicable_skills:
            skills_text = "\n\n".join(
                f"Skill [{s.name}]:\n{s.instructions}" for s in applicable_skills
            )
            context_blocks.append(f"### Applicable Learned Skills\n{skills_text}")

        if memories:
            mems_text = "\n".join(f"- {m.summary}" for m in memories)
            context_blocks.append(f"### Cross-Session Memory\n{mems_text}")

        for ctx in expanded_mentions:
            context_blocks.append(f"### Mention [{ctx.mention_type} - {ctx.target}]\n{ctx.content}")

        full_context = "\n\n".join(context_blocks)
        messages = [
            {"role": "system", "content": f"{system_prompt}\n\n{full_context}"},
            {"role": "user", "content": user_prompt},
        ]

        # 5. Check if compaction is needed
        if len(self.event_log.get_events()) > self.config.compaction_threshold_events:
            self._compact_context(messages)

        # 6. LLM Completion call
        resp = self.router.complete(
            messages=messages,
            reasoning_effort="high",
            mock_response=mock_response,
        )

        content = resp.get("content", "")

        # 7. Record agent message event
        self.event_log.append(
            AgentEvent(
                event_type=EventType.AGENT_MESSAGE,
                payload={"response": content, "usage": resp.get("usage", {})},
            )
        )

        # 8. Verification loop (if enabled and command provided)
        verification_passed = True
        verification_details = None
        if self.config.auto_verify and self.config.test_command:
            ver_res: VerificationResult = self.verifier.verify_command(
                self.config.test_command
            )
            verification_passed = ver_res.passed
            verification_details = {
                "command": ver_res.command,
                "passed": ver_res.passed,
                "exit_code": ver_res.exit_code,
                "failure_reasons": ver_res.failure_reasons,
            }
            self.event_log.append(
                AgentEvent(
                    event_type=EventType.VERIFICATION,
                    payload=verification_details,
                )
            )

        # 9. Autonomous AI skill synthesis check
        synthesized_skill = None
        if self.synthesizer and self.synthesizer.should_synthesize_skill(self.event_log):
            synthesized_skill = self.synthesizer.synthesize_from_session(
                session_id=self.config.session_id,
                task_prompt=user_prompt,
                event_log=self.event_log,
                mock_output=None if not mock_response else f"---\nname: \"auto-{self.config.session_id[:6]}\"\ndescription: \"Learned skill\"\ntags: [\"refactor\"]\ncreated_at: \"2026-08-19T00:00:00Z\"\n---\n# Auto Skill\nVerified procedure.",
            )

        return {
            "session_id": self.config.session_id,
            "response": content,
            "verification": verification_details,
            "verified": verification_passed,
            "synthesized_skill": synthesized_skill.name if synthesized_skill else None,
            "event_count": len(self.event_log.get_events()),
        }

    def _compact_context(self, messages: List[Dict[str, str]]) -> None:
        """Executes context compaction with pre/post hooks."""
        preserved = {}
        for hook in self.pre_compact_hooks:
            preserved.update(hook(self.event_log))

        self.event_log.append(
            AgentEvent(
                event_type=EventType.CONDENSATION,
                payload={"preserved": preserved},
            )
        )

        for post_hook in self.post_compact_hooks:
            post_hook(preserved, messages)
