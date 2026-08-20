# Building a Cursor-class desktop AI IDE from existing open-source projects
### Research & architecture reference — August 2026

This document is the result of researching the current (2026) open-source landscape for AI coding tools, so that instead of building from scratch, we assemble the IDE from proven, MIT/Apache-licensed codebases and wire them together. It covers: what to take from where, why, the licensing situation, the newest techniques worth adopting, and a phased build plan.

---

## 1. The four tools you asked about, and what they actually are

| Tool | What it really is | License | Relevance to us |
|---|---|---|---|
| **Cursor** | Closed-source VS Code fork. Excellent UX, but proprietary backend — cannot be forked or embedded. | Proprietary | Reference for UX only, not usable as source |
| **Claude Code** | Anthropic's agentic terminal/IDE coding tool. Closed product, but its underlying engine is exposed via the Claude API (no SDK is part of CromaX's stack — see §3 below). | API: usable via metered billing | Reference for UX; **not** used as a library |
| **Hermes Agent** (Nous Research) | A persistent, self-improving personal agent with cross-session memory and auto-generated skills. Not primarily a coding tool. | **MIT**, github.com/NousResearch/hermes-agent | Source for the memory/skills subsystem |
| **OpenClaw** | A personal-assistant *gateway* that routes one agent across 20+ messaging platforms (WhatsApp, Telegram, Discord, etc.) with cron/heartbeat automation. | **MIT**, github.com/openclaw/openclaw | Source for the optional remote-notification/automation layer, not core IDE logic |

Since Cursor itself can't be forked, the practical move was historically to start from **Void** — but `voideditor/void` was archived in June 2026 and is no longer accepting contributions. It remains an excellent reference codebase and continues to build/run as-is, so it is one valid fork base, but it is not actively maintained upstream of that point. The current (2026) set of actively-maintained alternatives is documented in `IMPLEMENTATION-PLAN.md` and needs to be re-decided before Phase 1 begins — this document's specific recommendation is therefore historical context rather than a present-tense directive.

---

## 2. The foundation: Void (UI shell)

- **github.com/voideditor/void** — **Apache-2.0** license (not MIT as older revisions of this document stated — re-check the repo's `LICENSE.txt` before vendoring any code). A direct fork of VS Code that already reimplements Cursor's core UX: inline "Quick Edit," autocomplete ("Tab"), an Agent Mode chat sidebar, a Gather/read-only mode, and — critically — **fast diff-based edits across thousand-line files**, applied the way a human would edit rather than full-file rewrites. **Note:** this repository was archived on June 2, 2026 — see the closing notes at the bottom of this section.
- Because it's a VS Code fork, all existing VS Code extensions, themes, and keybindings work immediately, and the whole extension/LSP ecosystem is available for free.
- Void does not route your code through a proprietary backend — all prompt-building happens client-side, so you fully control which model backend it talks to. That makes it a clean base to point at your own agent engine instead of Void's default one.

**Historical recommendation (superseded by archival, June 2026):** fork Void as the editor shell. The codebase remains a high-quality reference for anyone forking VS Code, but no upstream merges are possible after archival. The current decision of which base to use (Void directly, a community Void successor, a fresh fork of VS Code, or a non-fork extension-style approach) is captured in `IMPLEMENTATION-PLAN.md` and is the single highest-leverage choice for the project. Do not rebuild an editor from scratch — that's hundreds of engineer-months of work (text buffer, LSP client, extension host, syntax highlighting, diffing UI) that any of these forks has already solved on top of VS Code's proven core.

**Apache-2.0 patent-grant note (applies if Void is chosen as the fork base):** Apache-2.0 grants an explicit patent license from contributors to users, terminating if the user initiates patent litigation against the project over the contributed code. This is friendlier to commercial use than MIT's silence on patents but is **not** equivalent to MIT — confirm the CromaX distribution model is compatible before shipping to enterprise users who may redistribute.

---

## 3. The agent engine: model-agnostic, OpenHands-pattern (overriding earlier options)

> **Note (2026-Q3):** this section's earlier "Option A — Claude Agent SDK / Option B — OpenHands Agent SDK" framing is preserved below as historical context, but neither is the current recommended approach. The Claude Agent SDK was Claude-only and is no longer on the table (CromaX routes through LiteLLM, see `AGENTS.md §2a`); the OpenHands Agent SDK itself is also no longer the recommended primary interface (its `Workspace` + event-sourcing pattern still is, but CromaX implements that pattern directly rather than taking the SDK as a dependency). Use the **single recommendation** at the end of this section; treat the two option blocks below as background reading.

### Historical Option A — Claude Agent SDK (Anthropic) [no longer on the table]
This is the harness that runs Claude Code, exposed as a library: tool-use loop, file/bash/web-search tools, **automatic context compaction**, subagents with isolated context windows, hooks (including `PreCompact`/`PostCompact` for injecting must-survive context before the window is summarized), permission checkpoints, and native MCP client support.
- Pros: highest coding quality (same engine as Claude Code), least glue code, built-in cost/token accounting.
- Cons: Claude-only (no multi-model routing) — from June 15, 2026 it's billed separately per token via an SDK credit on top of a Pro/Max plan.

### Historical Option B — OpenHands Agent SDK (All-Hands-AI, formerly OpenDevin)
An MIT-licensed, model-agnostic (LiteLLM-based, 100+ providers) agent SDK with a **V1 architecture** built around:
- An **event-sourced state model** — every step is an immutable event (`MessageEvent`, `ActionEvent`, `ObservationEvent`, `Condensation`, etc.) and the log is the single source of truth, so any session can be deterministically replayed for debugging.
- A **Workspace abstraction** — the same agent code runs against `LocalWorkspace` (in-process, fast prototyping), `DockerWorkspace` (sandboxed container), or `RemoteAPIWorkspace` (HTTP-delegated remote execution) — swap environments without touching agent logic.
- Native sandboxed execution + a built-in security analyzer for agent actions — something the OpenHands paper notes as unique versus the OpenAI/Claude/Google agent SDKs.

**Current recommendation (replaces both options above):** implement the **OpenHands `Workspace` + event-sourcing pattern directly in CromaX's orchestrator** (rather than taking the SDK as a dependency), and route model calls through **LiteLLM** (`BerriAI/litellm`, MIT) so the reasoning engine is model-agnostic. Default reasoning model is **Gemini 3.6 Flash at the "High" reasoning-effort level** for anything touching more than one file (see `AGENTS.md §2a` for the operational reasoning behind this and for why the Gemini reasoning-effort API surface must be re-verified against `ai.google.dev/gemini-api/docs` before hardcoding). Claude and other providers remain routable through LiteLLM as the project evolves — they are not the default and the Claude Agent SDK is not part of the stack. This combines: (a) Claude/OpenAI/Google-quality reasoning without per-vendor lock-in, (b) OpenHands's battle-tested event-sourced replayability for debugging, and (c) LiteLLM-normalized tool-surface across Ollama (local), Gemini (cloud), and OpenRouter (cloud, multi-model) per `IMPLEMENTATION-PLAN §3.1`.

---

## 4. Codebase understanding: Aider's repo map (the single most important piece for multi-file refactoring)

This is the feature that most directly serves your stated priority ("full knowledge of the project when building").

Aider's repo map is a **tree-sitter + PageRank** system:
1. Every source file is parsed with tree-sitter to extract `def` (definitions) and `ref` (reference/usage) tags, language-agnostically across 100+ languages.
2. A directed graph is built where files are nodes and symbol references are edges.
3. **PageRank** ranks files/symbols by how central they are to the codebase — with edge-weight multipliers favoring identifiers that are well-named, currently mentioned in chat, or already open.
4. A binary-search token-budgeting step compacts the ranked map to fit whatever context budget you set (defaults to ~1K tokens, scalable).
5. Everything is SQLite-cached by file mtime, so re-indexing an unchanged repo is nearly free.

This is exactly what lets an agent understand "if I change this function, what else breaks" without dumping the whole repo into context. Aider itself reports processing 15B+ tokens/week with this system in production.

- **Source to fork directly:** `github.com/Aider-AI/aider` (repo map lives in `aider/repomap.py`), or the standalone extraction `github.com/pdavis68/RepoMapper` / `github.com/Cryect/RepoMapper`, which packages the exact same algorithm as **both a CLI tool and an MCP server** — meaning you can run it as a pluggable tool any agent (yours, Hermes-based, or Claude) can call, rather than re-embedding the logic.
- **Complementary layer:** semantic (embedding-based) search on top, since the tree-sitter map is symbol-level, not meaning-level — it will miss logic that's relevant but doesn't share identifier names. Notably, this exact combination (repo map + semantic search) is already being tracked as a feature request against Hermes Agent itself (issue #535 on NousResearch/hermes-agent), which is worth reading before implementing — someone has already scoped the integration.

---

## 5. Persistent memory & self-improving skills: take this from Hermes Agent

This is the piece that answers your "new optimized systems for memory" ask. Hermes Agent's distinguishing feature is a **closed learning loop**:
- Agent-curated memory with periodic self-nudges to persist what it's learned
- Autonomous skill creation — when the agent solves something novel, it can turn the successful procedure into a reusable skill file
- Skill self-improvement during subsequent use
- **FTS5** (SQLite full-text search) cross-session recall with LLM summarization for fast retrieval of past context
- Optional pluggable external memory backends (Honcho, Mem0, and others) for deeper user modeling

**Recommendation:** fork the memory/skills subsystem out of `github.com/NousResearch/hermes-agent` rather than rebuilding it. Concretely, this becomes: after any successful multi-file refactor, the orchestrator writes a skill file describing the pattern (e.g., "renaming a shared interface requires updating implementers in X, tests in Y, and the mock factory in Z") that gets checked before future similar tasks — closing the loop your context engine alone can't close, since indexing tells you *what* is connected, not *what has worked before*.

Skills should be written to the **agentskills.io** open standard (which Hermes Agent already targets) so they're portable and shareable rather than a bespoke format.

---

## 6. Optional v2 layer: OpenClaw's Gateway pattern

OpenClaw's core contribution is architectural: a single **Gateway** process as the control plane for sessions, channels, tools, and events, fanning one agent identity out across 20+ messaging platforms with cron/heartbeat-driven automation, entirely self-hosted.

For a refactoring-focused IDE this is genuinely secondary — but the pattern is cheap to leave room for: "notify me on Discord when the background refactor agent finishes" or "let me approve a risky diff from my phone" are both just the Gateway pattern applied to your orchestrator's event log (which, if you build on OpenHands's event-sourced model, you already have for free).

**Recommendation:** don't build this in v1. Structure the orchestrator's event stream so a Gateway-style adapter *could* subscribe to it later, and fork OpenClaw's channel-adapter code when you actually get there rather than now.

---

## 7. Latest techniques worth adopting (2026 state of the art)

**Context engineering / compaction.** Long-running agent sessions blow past context windows. The current best practice (validated by the Claude Agent SDK's design and independent benchmarking) is automatic compaction with `PreCompact`/`PostCompact` hooks that let critical state (open plan, active skills, running subagents) survive the compaction boundary rather than being silently dropped. Pure "never compact" scores highest on raw quality but costs 2–6x more tokens and much longer wall-clock time — compaction-with-hooks is the practical middle ground.

**Event-sourced, replayable agent state.** OpenHands's V1 architecture (November 2025 onward) replaced a monolithic controller with an append-only event log as the single source of truth. This is a debuggability and reliability win worth adopting regardless of which SDK you build on: if every action is a replayable event, "why did the agent do that" becomes answerable instead of a mystery.

**AGENTS.md as the instruction-file standard.** As of 2026, `AGENTS.md` is a jointly-stewarded open standard (Google, OpenAI, Cursor, Sourcegraph, Factory, now under the Linux Foundation's Agentic AI Foundation) for giving coding agents project context — effectively "README for agents." It has replaced the fragmented `.cursor/rules`, `.clinerules`, `CLAUDE.md`-only landscape as the interoperable default (Claude Code supports it alongside its native `CLAUDE.md`). Research (Gloaguen et al., 2026) found that **generic architecture-overview sections don't help** — agents navigate large repos fine without a directory map — while **commands, hard version constraints, and non-standard/non-obvious conventions do help**. This directly informs the companion file below.

**Hallucination mitigation is now a systems problem, not a prompting problem.** 2026 consensus across multiple independent write-ups: layering RAG-style grounding (retrieve real code before generating), deterministic verification loops (run the tests, don't just claim they pass), and citation/traceability logging cuts hallucination-driven errors by 70–90%+ versus an ungrounded agent. Multi-step agent tool-call chains are the highest-risk surface (20–40% hallucination rate on ungrounded chains per one meta-analysis) — which is exactly the "multi-file refactoring" workload you're targeting, and exactly why the repo-map + skills-memory + verification-loop combination above isn't optional polish, it's the core reliability mechanism.

**MCP as the tool-integration standard.** All four reference projects (Claude Code, Cursor, Hermes, OpenClaw) converge on Model Context Protocol as the way to plug in external tools (git, browser, databases, custom APIs) rather than hardcoding integrations. Hermes Agent maintains a curated/vetted MCP catalog worth using as a starting tool registry instead of building one from zero.

---

## 7a. Additional tools worth adding

Three more open-source projects fill gaps the core stack (§2–§6) doesn't cover:

- **Serena** — `github.com/oraios/serena` (MIT). Provides LSP-backed, symbol-level code editing tools (`find_symbol`, `find_referencing_symbols`, `insert_after_symbol`) via an MCP server. Where Aider's repo map answers "what's relevant," Serena is the execution layer that answers "how do I precisely edit this without regex guesswork" — it turns cross-file renames/moves into single atomic operations instead of multi-step, error-prone text edits. Given the project's core priority is multi-file refactoring, this should be treated as core, not optional — add it to §2's subsystem table alongside the repo map.
- **ast-grep** — `github.com/ast-grep/ast-grep` (Rust). Structural (AST-based) search and rewrite — "find every call matching this shape" or "rewrite this pattern across the repo" — as opposed to Serena's symbol/reference navigation. Complementary tool, not a replacement: ast-grep for pattern-based bulk rewrites, Serena for symbol-graph navigation and precise single-site edits.
- **Morph Fast Apply** — `morphllm.com` — **not open-source** (hosted API), flagged here as a technique rather than a fork target. It separates "decide what to change" (the reasoning model) from "merge the change into the file" (a small model specialized for fast, accurate patch application), avoiding both slow full-file rewrites and fragile search-and-replace matching. If staying fully open-source matters, treat this as a v2 build-your-own-equivalent item rather than a dependency — the technique (dedicated apply step) is the useful part even if this specific vendor isn't used.

Updated subsystem table addition for §2:

| Subsystem | Repo | License |
|---|---|---|
| Symbol-level semantic editing | oraios/serena | MIT |
| Structural search/rewrite | ast-grep/ast-grep | MIT-style |

---

## 8. Proposed architecture

```
Void (VS Code fork) — editor shell, diff review UI, chat sidebar
        │
        ▼
Orchestrator — OpenHands Agent SDK pattern (event-sourced, Workspace-abstracted)
        │
        ├──▶ Reasoning: Claude models via Agent SDK (or LiteLLM for multi-model)
        ├──▶ Context: Aider repo map (tree-sitter + PageRank) + semantic search, as an MCP tool
        ├──▶ Memory/Skills: forked from Hermes Agent (FTS5 recall + autonomous skill files)
        ├──▶ Tools: MCP catalog (git, terminal, browser, linters, test runners)
        └──▶ Execution: sandboxed Workspace (local for dev, Docker/remote for isolation)

(v2, optional) Gateway — OpenClaw pattern, subscribes to orchestrator's event log
        for cross-device notifications and remote approvals
```

---

## 9. Licensing summary (everything here is legally forkable — verify licenses live, not from this table)

| Component | Repo | License (verify before vendoring) |
|---|---|---|
| Editor shell | `voideditor/void` | **Apache-2.0** (not MIT as older revisions of this document stated; check `LICENSE.txt` upstream). Archived June 2026. Apache-2.0 includes an explicit patent grant that terminates on patent litigation — relevant if shipping to enterprise users who redistribute. |
| Orchestration pattern (not as an SDK dependency) | `All-Hands-AI/OpenHands` | MIT — only the `Workspace` + event-sourcing *pattern* is reused; CromaX implements it directly, no SDK dependency |
| Reasoning engine (via LiteLLM, model-agnostic) | `BerriAI/litellm` for routing; Gemini / Claude / OpenAI / local Ollama as model backends | LiteLLM is MIT; per-model provider billing applies per their respective terms |
| Repo map (algorithm reference) | `Aider-AI/aider` (`repomap.py`), `pdavis68/RepoMapper`, `Cryect/RepoMapper` | MIT |
| Memory / FTS5 recall (pattern reference) | `NousResearch/hermes-agent` | MIT |
| Symbol-level semantic editing (MCP server, not vendored) | `oraios/serena` | MIT |
| Structural search/rewrite (CLI/library, vendored or called) | `ast-grep/ast-grep` | MIT |
| LSP-style editing tools | `oraios/serena` (already listed) | MIT |
| Gateway (v2, optional) | `openclaw/openclaw` | MIT |

**Self-correction note:** earlier revisions of this table listed every component as MIT. That is no longer correct for the editor shell. Re-verify each row against the upstream `LICENSE` file before vendoring code — licenses can change without the upstream announcing it, and table-stakes errors here carry directly into shipped binaries. Apache-2.0 has an explicit patent grant that MIT does not, which is generally friendlier to commercial redistribution but is **not** equivalent to MIT and must be checked against CromaX's distribution model. Preserve original license headers and add attribution comments per `AGENTS.md §0.5` and §6 when vendoring rather than reimplementing a described algorithm.

---

## 10. Phased build plan

> **Preface (updated 2026-Q3):** step 1's "fork Void" wording is preserved because Void remains the historical reference, but `voideditor/void` was archived in June 2026 and the base-fork choice is up for re-decision (community Void successors, a fresh VS Code fork, or a non-fork extension-style approach). See `IMPLEMENTATION-PLAN.md` for the current operational plan.

1. **Editor shell — choose and fork.** Confirm or pick the editor fork base (Void archived, community successor, fresh VS Code fork, or extension route). Get it building and running with your own model backend pointed at a placeholder API. This validates the UI shell end-to-end before any agent logic exists.
2. **Stand up the context engine.** Integrate the Aider/RepoMapper repo map as a service (or MCP server) the orchestrator can query. Nothing else works well without this.
3. **Build the orchestrator loop.** Adopt the OpenHands event-sourced + `Workspace` pattern as the in-process design (do not take the OpenHands SDK as a dependency); route all model calls through **LiteLLM** with **Gemini 3.6 Flash (High reasoning)** as the default for multi-file work, per `AGENTS.md §2a`. Claude and others remain routable options but the Claude Agent SDK is not part of the stack.
4. **Wire the diff-review UI** (the chosen editor shell's existing diff UI, e.g. Void's inherited VS Code diff viewer) to the orchestrator's proposed edits — nothing applies without visible, approvable diffs.
5. **Fork in the Hermes memory/skills subsystem**, scoped initially to per-project skill files (defer cross-session personal-agent features).
6. **Add MCP tools** (git, terminal, test runner, linter) via the existing Hermes-curated catalog rather than writing new integrations.
7. **(v2)** Fork OpenClaw's Gateway adapter for optional remote notifications/approvals once the core loop is stable.

---

## 11. Sources consulted

- voideditor/void (GitHub, YC company page, InfoQ coverage)
- Cline/Aider/Continue.dev/OpenHands comparison pieces (RockB, PromptQuorum, opensourceaireview.com, morphllm.com) — 2026
- aider.chat repo-map documentation; Aider-AI/aider DeepWiki; emsenn.net architecture analysis; pdavis68/RepoMapper and Cryect/RepoMapper
- NousResearch/hermes-agent official docs and GitHub issue #535 (PageRank repo map feature request)
- openclaw/openclaw GitHub, DigitalOcean and BrightCoding writeups
- All-Hands-AI OpenHands: arXiv 2407.16741 (original paper), arXiv 2511.03690 (V1 SDK paper), dev.to deep-dive, Daytona/Spheron deployment guides
- agents.md specification site, DeepWiki, Augment Code and ASDLC.io guides on AGENTS.md content quality
- Anthropic Claude Agent SDK guides (o-mega.ai, helply.com, alloq.digital, Totalum, CodeLucky) — 2026
- 2026 hallucination-mitigation research summaries (FutureAGI, Zep, Braintrust, Keymakr, Zylos)

*Note: several of the above are third-party blog/analysis sources rather than primary vendor documentation, and version numbers, pricing, and star counts move quickly — re-verify anything load-bearing (pricing, exact API surface) against the primary repo/docs before building against it.*
