# orchestrator/src/context/repomap_client.py
#
# Client connecting to the native Rust repo-map binary for fast symbol indexing.

import json
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional


class RepoMapClient:
    def __init__(self, binary_path: Optional[str | Path] = None) -> None:
        if binary_path is not None:
            self.binary = Path(binary_path)
        else:
            # Default target location from Cargo build
            root = Path(__file__).parent.parent.parent.parent
            self.binary = root / "native" / "target" / "debug" / "repo-map.exe"
            if not self.binary.exists():
                self.binary = root / "native" / "target" / "debug" / "repo-map"

    def get_repo_map(
        self,
        workspace_root: str | Path,
        token_budget: int = 2048,
        active_files: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Calls the native Rust repo-map engine and returns ranked symbol context."""
        active_str = ",".join(active_files) if active_files else ""

        if self.binary.exists():
            cmd = [
                str(self.binary),
                str(workspace_root),
                str(token_budget),
                active_str,
                "--json",
            ]
            try:
                proc = subprocess.run(
                    cmd, capture_output=True, text=True, timeout=15
                )
                if proc.returncode == 0:
                    return json.loads(proc.stdout)
            except Exception:
                pass

        # Fallback basic directory outline if binary is not yet compiled
        root_path = Path(workspace_root)
        files = [
            str(p.relative_to(root_path)).replace("\\", "/")
            for p in root_path.rglob("*")
            if p.is_file()
            and not any(
                part in p.parts
                for part in [".git", "target", "node_modules", "__pycache__", ".venv"]
            )
        ]
        outline = "\n".join(f"- {f}" for f in files[:50])
        return {
            "formatted_map": f"Repository Files:\n{outline}",
            "file_ranks": {f: 1.0 for f in files[:50]},
            "estimated_tokens": len(outline) // 4,
        }
