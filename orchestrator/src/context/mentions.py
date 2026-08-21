# orchestrator/src/context/mentions.py
#
# Cursor-style @-mentions context expansion engine.
# Expands @file, @symbol, @folder, @git, and @problems into prompt context.

import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional
from ..core.workspace import Workspace


@dataclass
class ExpandedContext:
    mention_type: str
    target: str
    content: str


class ContextExpander:
    def __init__(self, workspace: Workspace) -> None:
        self.workspace = workspace
        # Put direct file extension pattern first so @main.py matches file before generic tag
        self.mention_pattern = re.compile(
            r"@([a-zA-Z0-9_\-\./\\]+\.[a-zA-Z0-9]+)|@([a-zA-Z0-9_\-]+)(?::([^\s]+))?"
        )

    def extract_and_expand(self, prompt: str) -> List[ExpandedContext]:
        """Scans a user prompt for @mentions and retrieves the corresponding context."""
        expanded: List[ExpandedContext] = []

        for match in self.mention_pattern.finditer(prompt):
            direct_file = match.group(1)
            tag_type = match.group(2)
            target = match.group(3)

            if direct_file:
                ctx = self._expand_file(direct_file)
                if ctx:
                    expanded.append(ctx)
                continue

            if not tag_type:
                continue

            tag_type_lower = tag_type.lower()
            if tag_type_lower in ["file", "f"] and target:
                ctx = self._expand_file(target)
                if ctx:
                    expanded.append(ctx)
            elif tag_type_lower in ["folder", "dir"] and target:
                ctx = self._expand_folder(target)
                if ctx:
                    expanded.append(ctx)
            elif tag_type_lower == "git":
                ctx = self._expand_git()
                if ctx:
                    expanded.append(ctx)
            elif tag_type_lower == "problems":
                ctx = self._expand_problems()
                if ctx:
                    expanded.append(ctx)
            elif tag_type_lower == "symbol" and target:
                ctx = self._expand_symbol(target)
                if ctx:
                    expanded.append(ctx)

        return expanded

    def _expand_file(self, rel_path: str) -> Optional[ExpandedContext]:
        try:
            if self.workspace.file_exists(rel_path):
                content = self.workspace.read_file(rel_path)
                return ExpandedContext(
                    mention_type="file",
                    target=rel_path,
                    content=f"--- File: {rel_path} ---\n{content}",
                )
        except Exception:
            pass
        return None

    def _expand_folder(self, rel_path: str) -> Optional[ExpandedContext]:
        try:
            items = self.workspace.list_dir(rel_path)
            listing = "\n".join(f"- {i}" for i in items)
            return ExpandedContext(
                mention_type="folder",
                target=rel_path,
                content=f"--- Directory: {rel_path} ---\n{listing}",
            )
        except Exception:
            pass
        return None

    def _expand_git(self) -> Optional[ExpandedContext]:
        res_diff = self.workspace.run_command("git diff")
        res_status = self.workspace.run_command("git status -s")
        diff_text = res_diff.stdout.strip()
        status_text = res_status.stdout.strip()
        return ExpandedContext(
            mention_type="git",
            target="current",
            content=f"--- Git Status ---\n{status_text}\n\n--- Git Diff ---\n{diff_text}",
        )

    def _expand_problems(self) -> Optional[ExpandedContext]:
        res = self.workspace.run_command("git diff --check")
        problems = res.stdout.strip() if res.stdout else "No git whitespace/syntax warnings detected."
        return ExpandedContext(
            mention_type="problems",
            target="diagnostics",
            content=f"--- Workspace Problems/Diagnostics ---\n{problems}",
        )

    def _expand_symbol(self, symbol_name: str) -> Optional[ExpandedContext]:
        matches: List[str] = []
        sym_pattern = re.compile(rf"\b(def|class|function|const|let|var|type|interface)\s+{re.escape(symbol_name)}\b")
        try:
            for item in self.workspace.list_dir(""):
                if item.endswith((".py", ".ts", ".js", ".tsx", ".jsx", ".rs")):
                    try:
                        content = self.workspace.read_file(item)
                        for line_no, line in enumerate(content.splitlines(), start=1):
                            if sym_pattern.search(line):
                                matches.append(f"{item}:{line_no}: {line.strip()}")
                    except Exception:
                        continue
        except Exception:
            pass

        result_text = "\n".join(matches) if matches else f"No definition found for symbol: '{symbol_name}'"
        return ExpandedContext(
            mention_type="symbol",
            target=symbol_name,
            content=f"--- Symbol Definition: {symbol_name} ---\n{result_text}",
        )
