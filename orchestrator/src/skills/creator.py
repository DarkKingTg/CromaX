# orchestrator/src/skills/creator.py
#
# Autonomous AI Skill Synthesizer, ported from OpenClaw & Hermes Agent skill distillation loops.
# Automatically analyzes completed event logs and distills proven workflows into agentskills.io skills.

import re
from pathlib import Path
from typing import Any, Dict, List, Optional
from ..core.events import AgentEvent, EventLog, EventType
from ..llm.router import LLMRouter
from ..memory.skills import Skill, SkillManager
from ..memory.store import MemoryStore


SKILL_SYNTHESIS_SYSTEM_PROMPT = """
You are an expert AI workflow engineer for CromaX IDE.
Your task is to analyze a completed coding session trajectory and distill it into a reusable skill following the agentskills.io standard.

The skill document must follow this exact YAML frontmatter and Markdown format:

---
name: "kebab-case-descriptive-name"
description: "Clear, concise description of when an AI agent should trigger and use this skill"
tags: ["tag1", "tag2", "tag3"]
created_at: "YYYY-MM-DDTHH:MM:SSZ"
---

# Skill Title

## Overview
Brief summary of the pattern or procedure.

## Step-by-Step Procedure
1. First step with exact file locations or tool commands.
2. Next steps with edge cases to watch for.

## Verification
- Commands to run to verify the change.
- Common failure modes and how to resolve them.
"""


class SkillSynthesizer:
    def __init__(
        self,
        skill_manager: SkillManager,
        memory_store: MemoryStore,
        router: Optional[LLMRouter] = None,
    ) -> None:
        self.skill_manager = skill_manager
        self.memory_store = memory_store
        self.router = router or LLMRouter()

    def should_synthesize_skill(self, event_log: EventLog) -> bool:
        """Determines if a session trajectory warrants skill creation (e.g. multi-step success)."""
        events = event_log.get_events()
        actions = [e for e in events if e.event_type == EventType.ACTION]
        verifications = [
            e
            for e in events
            if e.event_type == EventType.VERIFICATION
            and e.payload.get("passed", False)
        ]

        # Trigger when at least 2 distinct actions occurred and verification succeeded
        return len(actions) >= 2 or len(verifications) >= 1

    def synthesize_from_session(
        self,
        session_id: str,
        task_prompt: str,
        event_log: EventLog,
        mock_output: Optional[str] = None,
    ) -> Optional[Skill]:
        """Distills the session into an agentskills.io skill document using AI."""
        events = event_log.get_events()

        # Build trajectory summary
        trajectory_lines = [f"User Goal: {task_prompt}\nTrajectory:"]
        for e in events:
            if e.event_type == EventType.ACTION:
                tool = e.payload.get("tool", "unknown")
                details = e.payload.get("details", "")
                trajectory_lines.append(f"- Action [{tool}]: {details}")
            elif e.event_type == EventType.OBSERVATION:
                summary = e.payload.get("summary", "")[:200]
                trajectory_lines.append(f"  Observation: {summary}")
            elif e.event_type == EventType.VERIFICATION:
                cmd = e.payload.get("command", "")
                passed = e.payload.get("passed", False)
                trajectory_lines.append(f"- Verification [{cmd}]: Passed={passed}")

        trajectory_text = "\n".join(trajectory_lines)

        messages = [
            {"role": "system", "content": SKILL_SYNTHESIS_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"Please distill this successful workflow into a reusable skill:\n\n{trajectory_text}",
            },
        ]

        if mock_output:
            raw_content = mock_output
        else:
            resp = self.router.complete(
                messages=messages,
                reasoning_effort="high",
                temperature=0.2,
            )
            raw_content = resp.get("content", "")

        # Parse generated skill
        parsed_skill = self.skill_manager._parse_skill_markdown(raw_content)
        if parsed_skill:
            # Save skill to disk
            saved_skill = self.skill_manager.create_skill(
                name=parsed_skill.name,
                description=parsed_skill.description,
                tags=parsed_skill.tags,
                instructions=parsed_skill.instructions,
            )

            # Record in SQLite FTS5 memory store
            self.memory_store.save_session_memory(
                session_id=session_id,
                summary=f"Skill '{saved_skill.name}': {saved_skill.description}",
                tags=",".join(saved_skill.tags),
            )

            return saved_skill

        return None
