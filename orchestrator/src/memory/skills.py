# orchestrator/src/memory/skills.py
#
# Autonomous skill creation and retrieval adhering to the agentskills.io open standard.
# Ported from Hermes Agent (NousResearch/hermes-agent, MIT).

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional


@dataclass
class Skill:
    name: str
    description: str
    tags: List[str]
    instructions: str
    created_at: str

    def to_markdown(self) -> str:
        tag_str = ", ".join(f'"{t}"' for t in self.tags)
        return (
            f"---\n"
            f'name: "{self.name}"\n'
            f'description: "{self.description}"\n'
            f"tags: [{tag_str}]\n"
            f'created_at: "{self.created_at}"\n'
            f"---\n\n"
            f"# {self.name}\n\n"
            f"{self.instructions}\n"
        )


STOPWORDS = {
    "a", "an", "the", "and", "or", "but", "if", "because", "as", "what", "which",
    "this", "that", "these", "those", "then", "just", "so", "than", "such", "both",
    "through", "about", "against", "between", "into", "throughout", "during", "before",
    "after", "above", "below", "to", "from", "up", "upon", "down", "in", "out", "on",
    "off", "over", "under", "again", "further", "then", "once", "here", "there", "when",
    "where", "why", "how", "all", "any", "both", "each", "few", "more", "most", "other",
    "some", "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very",
    "can", "will", "should", "now", "is", "am", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "having", "do", "does", "did", "doing", "for", "with", "by", "of",
}


class SkillManager:
    def __init__(self, skills_dir: str | Path) -> None:
        self.skills_dir = Path(skills_dir)
        self.skills_dir.mkdir(parents=True, exist_ok=True)

    def create_skill(
        self,
        name: str,
        description: str,
        tags: List[str],
        instructions: str,
    ) -> Skill:
        clean_name = re.sub(r"[^a-zA-Z0-9_\-]", "_", name.lower().strip())
        now = datetime.now(timezone.utc).isoformat()
        skill = Skill(
            name=clean_name,
            description=description,
            tags=tags,
            instructions=instructions,
            created_at=now,
        )

        file_path = self.skills_dir / f"{clean_name}.md"
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(skill.to_markdown())

        return skill

    def load_all_skills(self) -> List[Skill]:
        skills: List[Skill] = []
        for file in self.skills_dir.glob("*.md"):
            try:
                content = file.read_text(encoding="utf-8")
                skill = self._parse_skill_markdown(content)
                if skill:
                    skills.append(skill)
            except Exception:
                continue
        return skills

    def find_applicable_skills(self, task_prompt: str) -> List[Skill]:
        prompt_lower = task_prompt.lower()
        prompt_words = set(re.findall(r"\w+", prompt_lower)) - STOPWORDS
        matched: List[Skill] = []

        for skill in self.load_all_skills():
            # Exact match on skill name or tag
            if skill.name.lower() in prompt_lower or any(t.lower() in prompt_lower for t in skill.tags if t):
                matched.append(skill)
                continue

            # Check non-stopword overlap in description
            desc_words = set(re.findall(r"\w+", skill.description.lower())) - STOPWORDS
            overlap = prompt_words & desc_words
            if len(overlap) >= 2:
                matched.append(skill)

        return matched

    def _parse_skill_markdown(self, content: str) -> Optional[Skill]:
        frontmatter_match = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", content, re.DOTALL)
        if not frontmatter_match:
            return None

        fm_text = frontmatter_match.group(1)
        body = frontmatter_match.group(2).strip()

        name = ""
        description = ""
        tags: List[str] = []
        created_at = ""

        for line in fm_text.splitlines():
            line = line.strip()
            if line.startswith("name:"):
                name = line.split("name:", 1)[1].strip().strip('"\'')
            elif line.startswith("description:"):
                description = line.split("description:", 1)[1].strip().strip('"\'')
            elif line.startswith("tags:"):
                raw_tags = line.split("tags:", 1)[1].strip().strip("[]")
                tags = [t.strip().strip('"\'') for t in raw_tags.split(",") if t.strip()]
            elif line.startswith("created_at:"):
                created_at = line.split("created_at:", 1)[1].strip().strip('"\'')

        if not name:
            return None

        return Skill(
            name=name,
            description=description,
            tags=tags,
            instructions=body,
            created_at=created_at,
        )
