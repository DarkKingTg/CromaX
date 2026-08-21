# agent.md — CromaX IDE: Agent Working Rules

> This document is the **authoritative rulebook** for any AI coding agent working on the CromaX project.
> Read it in full before touching any file. Re-read the relevant section before starting each task.
> It complements `AGENTS .md` (high-level architecture) — this file focuses on **how** to work, not just what to build.

---

## 0. Project Identity — Know What You Are Building

**CromaX** is an AI-native desktop code editor built on two tightly coupled halves:

| Half | Directory | Stack | Purpose |
|------|-----------|-------|---------|
| **Editor** | `/editor` | TypeScript / VS Code fork (Void) | UI shell, React AI sidebar, diff widgets, extension host |
| **Orchestrator** | `/orchestrator` | Python 3.11+, LiteLLM, WebSocket | Agent execution, LLM routing, memory/skills, MCP tools, context expansion |

The editor and orchestrator communicate **exclusively over WebSocket** (`server.py` is the gateway).
Any agent working on cross-half features must understand both sides of this boundary.

---

## 1. The Non-Negotiable Rules (Read These First)

### 1.1 Source Before You Write

**Never implement from memory when a real upstream source exists.**

CromaX is an assembly of proven open-source systems, not a greenfield build. Before writing any non-trivial function:

1. Search for the upstream implementation (web search, or `grep` the vendored copy).
2. Read the actual source. Do not guess method names, config keys, or API shapes.
3. If you cannot find it, explicitly say so and either ask or implement the minimal version marked `# UNVERIFIED — implemented from first principles`.
4. Never invent a library, package, or API endpoint. If you are not certain a method exists, look it up.
5. When porting upstream code, **keep a comment citing the source**: `# ported from aider/repomap.py, Aider-AI/aider, MIT`.

### 1.2 No Emoji in Code or Comments

No emoji anywhere — not in code, comments, commit messages, docs, or UI strings — unless the project owner explicitly asks for one in a specific spot.

### 1.3 Run It, Don't Assert It

If you claim tests pass, you must have actually executed the test command and seen the output.
"This should work" is not verification. A clearly-marked `UNVERIFIED` block is better than a confidently wrong claim.

### 1.4 Stop and Flag Rather Than Guess

When uncertain about the correct approach, stop and say so. A flagged uncertainty the human can review is cheaper than a buried wrong implementation.

---

## 2. Codebase Map — Where Things Live

```
CromaX/
├── editor/                        # VS Code fork (Void upstream)
│   ├── src/                       # TypeScript extension host + core
│   ├── extensions/                # Built-in extensions
│   └── build/                     # Gulp build pipeline
├── orchestrator/
│   ├── src/
│   │   ├── server.py              # WebSocket entry point
│   │   ├── context/
│   │   │   └── mentions.py        # @-mention context expansion engine
│   │   ├── core/
│   │   │   └── workspace.py       # Workspace abstraction (Local/Docker)
│   │   ├── llm/
│   │   │   └── router.py          # LiteLLM-based model router
│   │   ├── memory/
│   │   │   └── skills.py          # Skill create/load/match (agentskills.io)
│   │   ├── mcp/                   # MCP tool catalog and registry
│   │   └── skills/                # Persisted skill .md files (runtime data)
│   ├── pyproject.toml             # uv/hatchling project config
│   └── uv.lock                    # Locked dependency tree
├── Docs/                          # Architecture docs and agent rules
├── scripts/                       # PowerShell setup / download scripts
└── Launch-CromaX.bat              # One-click launch script (Windows)
```

---

## 3. Upstream Sources — Go Read Them, Don't Guess

Every subsystem has a real upstream. Verify against the current source before implementing.

| Subsystem | Upstream Repository | Key Things to Read |
|-----------|--------------------|--------------------|
| Editor shell | `github.com/voideditor/void` | `VOID_CODEBASE_GUIDE.md`, `VOID_USEFUL_LINKS.md` |
| Agent orchestration | `github.com/All-Hands-AI/OpenHands` | `Workspace` abstract class, event-sourced state model |
| LLM routing | `litellm` docs (`docs.litellm.ai`) | `completion()` signature, provider-specific params |
| Codebase indexing | `github.com/Aider-AI/aider` → `aider/repomap.py` | Tree-sitter tag extraction, PageRank graph, token-budget binary search |
| Memory / skills | `github.com/NousResearch/hermes-agent` | Skill-creation loop, FTS5 cross-session recall |
| MCP tools | `modelcontextprotocol.io` spec | Tool registry format, transport layer |
| Symbol editing | `github.com/oraios/serena` | `find_symbol`, `find_referencing_symbols`, `insert_after_symbol` |
| Structural rewrite | `github.com/ast-grep/ast-grep` | Pattern syntax (`$VAR`, `$$$`) — always verify from current docs |

---

## 4. Language-Specific Rules

### 4.1 Python (Orchestrator — `/orchestrator`)

- **Runtime**: Python >= 3.11. Use `uv` for dependency management, not `pip` directly.
- **Package manager**: Add dependencies via `uv add <package>` so `uv.lock` stays in sync.
- **Type annotations**: Required at all public function/API boundaries and complex data structures. Use `str | Path` union syntax (Python 3.10+ style), not `Union[str, Path]`. Avoid `Any` — use `object` or narrow types.
- **Dataclasses vs Pydantic**: Use `@dataclass` for simple internal structs. Use `pydantic.BaseModel` for anything validated at a boundary (WebSocket messages, LLM responses, MCP payloads).
- **Error handling**: Catch specific exceptions, not bare `except Exception`. Log the error before swallowing it.
- **Path handling**: Always use `pathlib.Path`, never raw string concatenation for file paths.
- **Workspace boundary**: Never call `open()` directly on a file that belongs to the user's project. Go through `Workspace.read_file()` / `Workspace.write_file()` to preserve the sandbox abstraction.
- **Async**: `server.py` and WebSocket handlers are `async`. Keep CPU-bound work out of the event loop — offload with `asyncio.to_thread()` if needed.

### 4.2 TypeScript (Editor — `/editor`)

- **Infer types wherever possible.** Add explicit annotations at public API surfaces, complex generics, and anywhere inference would force another agent to trace call sites.
- **Never use `any`.** Use `unknown` and narrow it, or find the correct type in VS Code's typings.
- **Match Void's existing conventions**, not personal style. Check surrounding files in the same directory before writing new code.
- **VS Code API**: Before calling any `vscode.*` namespace method, look up its current signature in the VS Code API docs or the `@types/vscode` package in `node_modules`. The API surface drifts between releases.
- **React AI sidebar**: Lives inside the editor's extension host via a WebView. State flows down from the extension host; WebSocket messages are the source of truth.

### 4.3 General (Both)

- Comment sparingly but meaningfully. Comment on *why*, not *what*. Never narrate obvious code line-by-line.
- Write readable code over clever one-liners. Avoid premature abstraction.
- Prefer the straightforward implementation. Build a plugin system only when you have multiple actual plugins.

---

## 5. WebSocket Protocol — Editor <-> Orchestrator Boundary

All cross-half communication goes through the WebSocket server at `orchestrator/src/server.py`.

**Before adding a new message type:**
1. Read `server.py` to see the current message dispatch table.
2. Define both the outbound (editor -> orchestrator) and inbound (orchestrator -> editor) shapes as `pydantic.BaseModel` in the orchestrator.
3. Mirror the shape as a TypeScript interface in the editor's WebSocket client.
4. Both sides must agree on the `type` discriminator field — do not add new message types without updating both ends in the same PR/commit.

---

## 6. Context Expansion (`mentions.py`)

The `ContextExpander` in `orchestrator/src/context/mentions.py` handles `@file`, `@folder`, `@git`, `@problems`, and `@symbol` mentions.

- Symbol resolution is currently a flat-file scan with a regex. It does not yet recurse into subdirectories.
- Before adding a new `@mention` type, check if the same information is available via an existing MCP tool first — prefer tool calls over raw file reads when a tool already exists for it.
- All file access inside `ContextExpander` must go through `self.workspace` — never call `open()` directly.

---

## 7. Memory and Skills (`skills.py`)

The `SkillManager` in `orchestrator/src/memory/skills.py` follows the agentskills.io open standard.

- Skills are stored as Markdown files with YAML frontmatter in `orchestrator/src/skills/`.
- The matching algorithm uses word-overlap on description (>= 2 non-stopword words) plus exact name/tag matching. It is intentionally simple — do not replace it with an embedding model without profiling the latency impact first.
- The `STOPWORDS` set is hand-curated. Add to it rather than replacing it.
- Skill names are sanitized to `[a-zA-Z0-9_\-]` on creation — do not bypass this by writing skill files manually.

---

## 8. LLM Routing (`router.py`)

- All model calls go through LiteLLM. Do not add direct SDK calls (Anthropic, OpenAI, Gemini) that bypass the router.
- Model identifiers follow LiteLLM's provider prefix format: `anthropic/claude-...`, `openai/gpt-...`, `gemini/gemini-...`, `ollama/...`. Verify the exact identifier string against the current LiteLLM docs before hardcoding it.
- Reasoning/thinking parameters differ per model. Do not assume the parameter name — check LiteLLM docs for the specific provider.
- Local models (Ollama, LM Studio) connect via OpenAI-compatible base URLs. The router must remain agnostic to whether the backend is cloud or local.

---

## 9. Build and Dev Commands

> Commands marked `TODO: verify` have not been run-and-confirmed yet. Replace with real output when verified.

### Orchestrator (Python)

```powershell
# Install deps (from /orchestrator)
uv sync

# Run the WebSocket server
uv run python -m src.server

# Run tests
uv run pytest

# Type check (if pyright/mypy is added)
# TODO: verify
```

### Editor (TypeScript / VS Code fork)

```powershell
# Install node deps (from /editor)
npm install

# Build the React AI sidebar
npm run buildreact

# Launch full IDE (from repo root)
.\Launch-CromaX.bat
```

### Fresh Clone Setup

```powershell
# Fetch required editor shell resources
.\scripts\download_repos.ps1
```

---

## 10. Testing Requirements

1. **Orchestrator**: Every new public function in `orchestrator/src/` must have at least one pytest test in `orchestrator/tests/`. Tests run with `uv run pytest`.
2. **Editor**: New agent-facing TypeScript functions should have a corresponding test in `editor/test/`. Match the test style already present in that directory.
3. **Integration**: WebSocket message flows must be exercised end-to-end at least once before being marked complete. Use a mock workspace (`LocalWorkspace` pointed at a temp dir) for isolation.
4. **Never mark a task done** if the test suite fails, even on tests unrelated to your change — investigate first.

---

## 11. License Compliance

- The editor (`/editor`) is dual-licensed: VS Code portions under MIT, Void additions under Apache-2.0. Check `LICENSE.txt` and `LICENSE-VS-Code.txt`.
- Orchestrator dependencies are MIT unless noted. Re-verify the `LICENSE` file of any upstream repo before vendoring substantial code.
- When copying a non-trivial block from an upstream repo, preserve its original license header and add a citation comment per Rule 1.1.

---

## 12. What Not to Do

| Temptation | Correct Action |
|------------|----------------|
| Write a tree-sitter extractor from memory | Read `aider/repomap.py` first |
| Hardcode a model string like `claude-3-5-sonnet-20241022` | Use LiteLLM's format and verify the current model ID in docs |
| Call `open(path)` inside ContextExpander | Go through `self.workspace.read_file(rel_path)` |
| Add a new @mention type without checking MCP tools first | Check the MCP registry; reuse existing tools |
| Use `any` in TypeScript | Use `unknown` + type narrowing |
| Bypass `SkillManager` and write skill files directly | Use `SkillManager.create_skill()` |
| Assume LiteLLM / VS Code API shapes from memory | Read current docs or `node_modules/@types/vscode` |
| Ship a "should work" claim without running tests | Run `uv run pytest` or equivalent and paste the output |

---

## 13. Pre-Completion Verification Checklist

Before marking **any** task done, confirm all of the following:

- [ ] Tests pass: ran the test command and saw the actual output.
- [ ] Multi-file change: checked the dependency graph for other references to changed symbols.
- [ ] WebSocket boundary: if message types changed, both editor and orchestrator are updated in the same commit.
- [ ] License: if upstream code was vendored, attribution comment and license header are present.
- [ ] No `any` in TypeScript, no bare `except Exception` in Python.
- [ ] No emoji introduced anywhere.
- [ ] Build and dev commands in Section 9 are still accurate — update them if your change affects them.

---

*Last updated: 2026-08-21. Update this file when new conventions are established, not retroactively.*
