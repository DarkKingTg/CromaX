# Implementation plan: Windows AI IDE (v1 — full scope)

Locked decisions this plan is built on:
- **Platform:** Windows only for v1
- **Scope:** Full — editor, repo-map context engine, Serena-style precise editing, persistent memory/skills, MCP tool catalog, all from day one
- **Languages:** TypeScript (editor/UI, forked from Void), Python (agent orchestrator + memory/skills), Rust (indexing/search layer only)
- **Editor base:** direct fork of `voideditor/void`
- **Model providers (v1):** Ollama (local), Gemini (cloud), OpenRouter (cloud, multi-model) — all through a provider-agnostic layer, not hardcoded per-provider calls
- **Reasoning engine in use:** Gemini 3.6 Flash, High reasoning effort, for anything touching more than one file

This document is written for an AI coding agent to execute phase by phase. Coding standards are defined once in `AGENTS.md` (§3a) and apply to everything below — this file does not repeat them, it references them. Every phase below names the exact upstream source to pull from before writing anything new, per `AGENTS.md` §0.

---

## 0. Repository layout

```
/editor/            <- fork of voideditor/void (TypeScript, Electron, VS Code base)
/orchestrator/       <- Python: agent loop, LiteLLM router, MCP client, memory/skills
/native/
  /repo-map/         <- Rust crate: tree-sitter + PageRank codebase indexing
  /bridge/           <- Rust crate: napi-rs bindings exposing /native to /editor
/docs/
  AI-IDE-Research-and-Architecture.md
  AGENTS.md
  IMPLEMENTATION-PLAN.md   <- this file
```

Rationale: three top-level language boundaries matching the three languages, so tooling per-language (cargo, pip/uv, npm) stays simple and the agent never has to guess which toolchain applies to a given directory.

---

## Phase 1 — Get the Void fork building on Windows

**Goal:** a running, unmodified Void build on Windows, before any custom code is added. This validates the whole toolchain first.

**Source:** `github.com/voideditor/void` — clone directly, do not recreate its build system.

**Steps:**
1. Clone the repo into `/editor`.
2. Follow Void's own `CONTRIBUTING.md` / build docs for Windows (it inherits VS Code's build requirements: Node.js version pinned by `.nvmrc`, Python for node-gyp on native VS Code deps, Visual Studio Build Tools with the "Desktop development with C++" workload for Windows native modules).
3. Confirm `yarn`/`npm install` and the dev build (`./scripts/code.bat` or equivalent, check Void's actual script names — do not assume they match upstream VS Code's) produce a launchable window.

**Reference:** Void's own repo documentation and `VOID_USEFUL_LINKS.md` (Void maintains this specifically to point contributors at the relevant upstream VS Code internals docs — read it before touching any editor-core code). Microsoft's VS Code wiki ("How to Contribute," "Development Environment Windows") for the underlying build requirements Void inherits.

**Acceptance criteria:** Void launches on Windows unmodified, with git history intact so future diffs against upstream Void stay reviewable.

---

## Phase 2 — Rust indexing/search engine

**Goal:** a native Rust module that builds the repo map (tree-sitter + PageRank) and exposes it to both the TypeScript editor and the Python orchestrator.

### 2.1 — Repo map core (port of Aider's algorithm)

**Source to port from:** `Aider-AI/aider`, specifically `aider/repomap.py`. Also read `pdavis68/RepoMapper` or `Cryect/RepoMapper` — these are already Python ports of the same algorithm packaged as an MCP server, useful as a second reference implementation to cross-check against while porting to Rust.

**Algorithm citation:** the ranking step is PageRank — Page, L., Brin, S., Motwani, R., & Winograd, T. (1999). *The PageRank Citation Ranking: Bringing Order to the Web.* Stanford InfoLab Technical Report. This is the original paper defining the algorithm Aider adapted for code-symbol graphs; read it if the graph-weighting logic needs adjusting, since Aider's own docs explain the code-specific edge-weight multipliers but not the base algorithm.

**Parsing dependency:** the `tree-sitter` Rust crate (`crates.io/crates/tree-sitter`) plus per-language grammar crates (e.g. `tree-sitter-typescript`, `tree-sitter-python`, `tree-sitter-rust`). Tree-sitter's own docs (`tree-sitter.github.io/tree-sitter/`) define the query-file (`.scm`) syntax used to extract `def`/`ref` tags — Aider's own `.scm` query files (in its repo under `aider/queries/`) can likely be reused directly or with minimal adaptation, since tree-sitter queries are language-grammar-specific, not tool-specific. Check their license and copy them rather than rewriting from scratch.

```rust
// native/repo-map/src/lib.rs
//
// Rust port of Aider's repo-map algorithm (aider/repomap.py, Aider-AI/aider, MIT).
// Two stages: (1) tree-sitter tag extraction per file, (2) PageRank over the
// resulting file/symbol graph to select what fits in the context budget.
//
// VERIFY BEFORE USE: the exact tree-sitter crate API (Parser::set_language,
// Query::new signatures) changes between tree-sitter versions -- confirm
// against the current crates.io docs before implementing, do not assume
// this matches whatever version you remember.

use tree_sitter::{Parser, Query, QueryCursor};

/// A single extracted tag: a definition or a reference to a named symbol,
/// with its location, used as a graph node/edge input.
struct Tag {
    file: String,
    name: String,
    kind: TagKind, // Definition or Reference
    line: usize,
}

enum TagKind {
    Definition,
    Reference,
}

/// Parses one source file with the tree-sitter grammar matching its
/// extension and runs the language's tag query to extract Definition/
/// Reference tags. This mirrors Aider's per-file tag extraction step.
fn extract_tags(_file_path: &str, _source: &str) -> Vec<Tag> {
    // TODO: load the correct grammar for the file extension, run the
    // matching .scm query (ported from Aider's aider/queries/ directory),
    // and collect def/ref tags. Left as a stub -- implement against the
    // verified tree-sitter API, do not guess the query-capture-name format.
    todo!("port tag extraction from aider/repomap.py get_tags_raw()")
}

/// Builds a directed graph (files as nodes, symbol references as edges)
/// and ranks it with PageRank, mirroring Aider's get_ranked_tags().
/// A dedicated graph crate (e.g. `petgraph`) should hold the graph; check
/// crates.io for the current best-maintained PageRank implementation or
/// petgraph extension rather than hand-rolling the power-iteration loop --
/// this is exactly the kind of "search before writing" case AGENTS.md
/// requires: PageRank is a well-known algorithm with existing crates.
fn rank_files(_tags: &[Tag], _token_budget: usize) -> Vec<String> {
    todo!("build graph, run PageRank, binary-search to fit token_budget, \
           mirroring aider/repomap.py get_ranked_tags_map()")
}
```

The `todo!()` stubs above are intentional — they mark exactly where the agent must go read the real Aider source and a verified tree-sitter/graph crate API before filling in logic, rather than generating plausible-looking Rust from memory.

### 2.2 — Structural search (ast-grep)

**Source:** `ast-grep/ast-grep` — this is *already* Rust and MIT-licensed. Do not reimplement it. Either (a) vendor it as a Cargo dependency/workspace member and call its library API directly, or (b) shell out to its compiled CLI binary from the orchestrator. Prefer (a) if `ast-grep` exposes its matching engine as a usable library crate (check `crates.io` — confirm before assuming); otherwise (b) is simpler and still fully correct. Reference: `ast-grep.github.io` for pattern syntax (`$VAR`, `$$$` wildcards).

### 2.3 — Exposing Rust to the TypeScript editor

**Bridge tool:** `napi-rs` (`napi.rs`, `github.com/napi-rs/napi-rs`) — the standard framework for building Node-API-compatible native Node.js/Electron addons in Rust, with prebuilt-binary support across Windows/macOS/Linux so end users don't need a Rust toolchain installed.

```rust
// native/bridge/src/lib.rs
//
// napi-rs bindings exposing the repo-map crate to the Electron (Void) frontend.
// Reference: napi-rs docs at https://napi.rs -- verify macro/attribute syntax
// against the current napi-rs major version before relying on this shape,
// the API has changed across versions (napi 2 vs napi 3).

use napi_derive::napi;

/// Called from the TypeScript side as `repoMap.buildContext(rootPath, tokenBudget)`.
/// Returns the ranked, budgeted context as a JSON string the orchestrator
/// (or the editor UI, for a quick preview) can consume directly.
#[napi]
pub fn build_context(root_path: String, token_budget: u32) -> String {
    // Delegates into native/repo-map's rank_files(); left unimplemented
    // here deliberately -- wire it up once repo-map's stub functions above
    // are filled in against verified APIs.
    todo!()
}
```

Build/packaging reference: `electronjs.org/docs/latest/tutorial/native-code-and-electron` (Electron's own docs on native addons, which explicitly lists napi-rs as a supported Rust option) and the `napi build` CLI docs at `napi.rs` for producing a `.node` file per target platform.

**Acceptance criteria:** given a real small repo, the Rust module produces a ranked, token-budgeted symbol map matching Aider's own output shape closely enough to be usable as LLM context, callable both from the TS editor (via napi-rs) and from the Python orchestrator (via a thin local service — see Phase 3 for how the orchestrator reaches it).

---

## Phase 3 — Python agent orchestrator

**Goal:** the agent loop itself — model-agnostic, calling Ollama/Gemini/OpenRouter through one interface, following the event-sourced/Workspace pattern from OpenHands rather than a bespoke loop.

**Source to study (do not copy wholesale, but follow the pattern):** `All-Hands-AI/OpenHands` — specifically its Agent SDK's `Workspace` abstraction and event-sourced state model (`MessageEvent`, `ActionEvent`, `ObservationEvent`). Paper reference: *The OpenHands Software Agent SDK: A Composable and Extensible Foundation for Autonomous Agents* (arXiv:2511.03690) documents the design rationale for this V1 architecture in detail — read it before designing the orchestrator's internal event types, since it explains *why* the event-sourced model replaced the earlier monolithic controller (V0), which matters for not repeating that mistake.

### 3.1 — Model routing (Ollama / Gemini / OpenRouter)

**Source:** `BerriAI/litellm` (MIT) — do not write a custom multi-provider abstraction, LiteLLM already normalizes all three target providers behind one `completion()` call.

```python
# orchestrator/llm/router.py
#
# Model-agnostic completion layer using LiteLLM (BerriAI/litellm, MIT).
# Reference: https://docs.litellm.ai/docs/providers/ollama
#            https://docs.litellm.ai/docs/providers/openrouter
#            https://docs.litellm.ai/docs/providers/gemini
#
# LiteLLM selects the provider from the model string's prefix, so routing
# is just string construction -- no per-provider branching needed here.

from litellm import completion


def call_model(model: str, messages: list[dict], **kwargs) -> dict:
    """Send a chat completion through LiteLLM.

    model examples:
      "ollama/qwen2.5-coder"        -> local Ollama, requires OLLAMA
                                        running with api_base set
      "gemini/gemini-3.6-flash"     -> Gemini via LiteLLM's Gemini provider
      "openrouter/<vendor>/<model>" -> any OpenRouter-hosted model

    Reasoning effort for Gemini 3.6 Flash should be set to "high" for any
    multi-file task -- see AGENTS.md section 2a for why this is mandatory,
    not optional, on this project. VERIFY the current parameter name for
    setting reasoning/thinking level against LiteLLM's Gemini provider docs
    before hardcoding it -- provider-specific parameters change.
    """
    return completion(model=model, messages=messages, **kwargs)
```

### 3.2 — Event-sourced orchestrator loop (OpenHands-inspired)

```python
# orchestrator/core/events.py
#
# Event-sourced state model, following the pattern documented in the
# OpenHands Agent SDK paper (arXiv:2511.03690). Every step in an agent
# session is an immutable event; the event log is the single source of
# truth and can be replayed for debugging -- this is a debuggability
# requirement for a project the human owner will not personally review
# line-by-line, not just an architectural preference.

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Literal


@dataclass(frozen=True)
class AgentEvent:
    kind: Literal["message", "action", "observation", "error"]
    payload: dict
    timestamp: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


class EventLog:
    """Append-only log. Replaying this list end-to-end must reconstruct
    the full session state -- do not add any mutable state outside this
    log that the replay would miss.
    """

    def __init__(self) -> None:
        self._events: list[AgentEvent] = []

    def append(self, event: AgentEvent) -> None:
        self._events.append(event)

    def replay(self) -> list[AgentEvent]:
        return list(self._events)
```

### 3.3 — Sandboxed execution (Workspace pattern)

**Source:** OpenHands's `Workspace` abstraction (`LocalWorkspace`, `DockerWorkspace`, `RemoteAPIWorkspace`) — same agent code should run against any of these without modification.

**Windows-specific note:** Docker-based sandboxing on Windows requires Docker Desktop with the WSL2 backend (there is no native Windows-container path that matches the Linux-container images most of these tools ship). Confirm the current Docker Desktop WSL2 setup requirements at `docs.docker.com/desktop/wsl/` before building the `DockerWorkspace` implementation — this is exactly the kind of detail in AGENTS.md §0 that must be verified live, not assumed.

**Acceptance criteria:** the orchestrator can run a scripted multi-step task (read file, propose a diff, run a test command) against a `LocalWorkspace` first (fastest to get working), with the event log fully reconstructing what happened afterward.

---

## Phase 4 — Editor <-> orchestrator bridge

**Goal:** connect the Electron/TypeScript editor (Phase 1) to the Python orchestrator (Phase 3).

**Pattern:** the orchestrator runs as a local subprocess exposing a WebSocket (for streaming agent output/diffs to the UI) and/or local HTTP endpoint, spawned and managed by Electron's main process — this mirrors OpenHands's own controller-to-runtime communication pattern (its runtime backend talks to the sandboxed runtime client over a REST/socket interface), applied here to editor-to-orchestrator instead of controller-to-sandbox.

```typescript
// editor/src/vs/workbench/contrib/aiOrchestrator/orchestratorClient.ts
//
// Thin WebSocket client the editor uses to stream agent events from the
// Python orchestrator subprocess. Kept deliberately minimal -- this is
// glue code with no existing open-source equivalent to source from, so
// per AGENTS.md paragraph 0.3 this is a case where writing it directly
// is correct rather than a hallucination risk.

export interface AgentEventMessage {
  kind: "message" | "action" | "observation" | "error";
  payload: unknown;
}

export class OrchestratorClient {
  private socket: WebSocket | null = null;

  connect(url: string, onEvent: (event: AgentEventMessage) => void): void {
    this.socket = new WebSocket(url);
    this.socket.onmessage = (raw) => {
      // The orchestrator always sends JSON-encoded AgentEvent objects
      // (see orchestrator/core/events.py) -- parse failures here mean
      // the two sides have drifted out of sync on the event schema.
      const event = JSON.parse(raw.data) as AgentEventMessage;
      onEvent(event);
    };
  }
}
```

**Acceptance criteria:** a task typed into the editor's chat sidebar reaches the Python orchestrator, and streamed `action`/`observation` events flow back and render live in the UI.

---

## Phase 5 — Diff-review UI

**Goal:** every proposed edit from the orchestrator renders as a reviewable diff in Void's existing diff UI before being applied — do not build a new diff renderer, Void already has one (it's a core part of what makes it Cursor-equivalent).

**Source:** study Void's existing Quick Edit / Agent Mode diff-application code paths before adding a new one — the goal is to route the orchestrator's proposed changes through Void's existing apply/reject UI, not to build a parallel one.

**Acceptance criteria:** a multi-file refactor proposal shows one diff per affected file, each independently approvable/rejectable, and rejected files are excluded from the applied change set.

---

## Phase 6 — Memory & skills subsystem

**Goal:** persistent, cross-session memory and auto-generated reusable skills, ported from Hermes Agent's design.

**Source:** `NousResearch/hermes-agent` — read its memory/skills implementation before building this; specifically the FTS5 (SQLite full-text search) cross-session recall mechanism and the skill-file format (targeting the open `agentskills.io` standard, per Hermes's own documentation, so skills stay portable rather than bespoke to this project).

```python
# orchestrator/memory/store.py
#
# FTS5-backed cross-session memory store, following the pattern documented
# in Hermes Agent (NousResearch/hermes-agent, MIT). SQLite's FTS5 extension
# gives full-text search over past session summaries without needing an
# external vector database for this layer -- semantic/embedding search is
# a separate, complementary concern (see repo-map's semantic layer, Phase 2).
#
# Reference: SQLite FTS5 documentation, https://sqlite.org/fts5.html --
# verify current pragma/table syntax against that doc, FTS5 syntax details
# are easy to get subtly wrong from memory.

import sqlite3


def init_memory_db(path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    conn.execute(
        """
        CREATE VIRTUAL TABLE IF NOT EXISTS session_memory
        USING fts5(session_id, summary, created_at)
        """
    )
    return conn
```

**Skill file convention:** each successfully completed multi-file task that required a non-obvious sequence of steps gets written as a skill file (Markdown + structured frontmatter, per the `agentskills.io` format — check the current spec before finalizing the frontmatter schema) so future similar tasks can be checked against it before the agent re-derives the same procedure from scratch.

**Acceptance criteria:** after a successful multi-file refactor, a skill file is written describing the pattern; a subsequent similar task retrieves and references it via the FTS5 store before starting.

---

## Phase 7 — MCP tool catalog

**Goal:** all external tool integrations (git, terminal, linter, test runner, browser) go through Model Context Protocol rather than bespoke per-tool code.

**Reference:** the official MCP specification at `modelcontextprotocol.io` — read the current spec before implementing a client, the message schema is versioned and has changed since MCP's initial release. Do not hand-roll a tool-registry format; MCP already defines the `tools/list` and `tools/call` shapes.

**Starting catalog:** rather than building a tool registry from zero, start from Hermes Agent's vetted MCP catalog (referenced in its release notes — search for the current list, it's actively maintained) and add only the tools genuinely missing from it (this project's own repo-map/Serena/ast-grep tools, wired as local MCP servers rather than remote ones).

**Acceptance criteria:** the orchestrator can list and call at least: git operations, a terminal/shell tool, a lint/typecheck tool, and the project's own repo-map tool, all through the same MCP client code path (no tool gets special-cased integration logic).

---

## Phase 8 — Symbol-precise editing (Serena) and structural rewrite (ast-grep)

**Goal:** wire the two precision-editing tools from the research doc's addendum into the MCP tool catalog from Phase 7, rather than relying on line-based search-and-replace for multi-file renames/moves.

**Source:** `oraios/serena` (MIT) — it already ships as an MCP server; connect to it as a client rather than reimplementing its LSP-backed symbol tools (`find_symbol`, `find_referencing_symbols`, `insert_after_symbol`). `ast-grep/ast-grep` — see Phase 2.2; expose its structural search/rewrite as an MCP tool wrapping either the vendored Rust library or the CLI binary.

**Acceptance criteria:** a cross-file rename task uses Serena's `find_referencing_symbols` to enumerate every call site before editing, rather than a codebase-wide text search.

---

## Phase 9 — Verification loop

**Goal:** the agent must run tests and confirm results, not assert success — this is the concrete mechanism behind AGENTS.md §5's "run it, don't assert it" rule.

**Reference for why this matters at the benchmark level:** Jimenez, C. E., et al. (2024). *SWE-bench: Can Language Models Resolve Real-World GitHub Issues?* — the benchmark methodology (apply a patch, run the real test suite, check pass/fail against ground truth) is the model for what "done" should mean for this orchestrator's own multi-file tasks: a change is not complete until the relevant tests have actually been executed inside the Workspace (Phase 3.3) and their real output inspected, not predicted.

```python
# orchestrator/core/verify.py
#
# After any multi-file edit, this step must actually execute the project's
# test command inside the current Workspace and parse real output -- never
# skip this and let the LLM's own claim of success stand in for it.

def verify_change(workspace, test_command: str) -> bool:
    result = workspace.run(test_command)
    # Do not trust an LLM-generated summary of `result` -- check the actual
    # process exit code, which is unambiguous, before anything else.
    return result.exit_code == 0
```

**Acceptance criteria:** no task is marked complete in the event log without a corresponding `observation` event containing real test-command output with a captured exit code.

---

## Phase 10 — Windows packaging

**Goal:** a distributable Windows build.

**Tooling:** `electron-builder` (already what Void/VS Code-based projects typically use) targeting an NSIS installer for Windows. Verify Void's own packaging scripts first — it likely already has a working Windows packaging path inherited from VS Code that just needs the orchestrator/native components bundled alongside it, rather than a packaging setup built from scratch.

---

## Summary of primary sources to keep open while building

| Phase | Primary source(s) |
|---|---|
| 1 | `github.com/voideditor/void` |
| 2 | `github.com/Aider-AI/aider` (`repomap.py`), `github.com/ast-grep/ast-grep`, `github.com/napi-rs/napi-rs`, `tree-sitter.github.io` |
| 3 | `github.com/All-Hands-AI/OpenHands`, arXiv:2511.03690, `github.com/BerriAI/litellm`, `docs.litellm.ai` |
| 4 | (project-specific glue, no direct source) |
| 5 | `github.com/voideditor/void` (existing diff UI) |
| 6 | `github.com/NousResearch/hermes-agent`, `sqlite.org/fts5.html`, `agentskills.io` |
| 7 | `modelcontextprotocol.io` |
| 8 | `github.com/oraios/serena`, `github.com/ast-grep/ast-grep` |
| 9 | Jimenez et al. 2024, SWE-bench paper |
| 10 | Void's own build/packaging scripts |
