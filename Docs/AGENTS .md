# AGENTS.md — build instructions for this project

This file follows the [agents.md](https://agents.md) open standard. It is written for an AI coding agent that will write the large majority of this codebase. The human owner will write roughly 1–2% of the code directly. Read this file in full before writing any code, and re-read the relevant section before starting each subsystem below.

## 0. The one rule that overrides everything else

**Never write code from memory when a real, verifiable source exists. Search for it first.**

This project is an assembly of several existing open-source systems, not a from-scratch build. Every subsystem below has a real upstream repository. Before implementing any function, class, API call, config format, or algorithm that belongs to one of these subsystems:

1. **Search for the actual upstream source** (web search, or `grep`/`view` the vendored copy if already cloned into this repo) before writing a single line.
2. **Read the real implementation** of the closest equivalent function. Do not guess at method names, config keys, CLI flags, or API shapes.
3. **If you cannot find the real source** for something you're about to implement, say so explicitly in your output and either (a) ask the human to point you at it, or (b) implement the smallest possible version and flag it clearly as `// UNVERIFIED — implemented from first principles, not sourced` so it can be reviewed and replaced.
4. **Never invent a library, package, function signature, or API endpoint.** If you're not certain a method exists on a class you're calling, look it up. A plausible-sounding name that doesn't exist is worse than admitting you don't know.
5. When you vendor or port code from an upstream repo, **keep a comment citing the source file and repo** (e.g. `// ported from aider/repomap.py, Aider-AI/aider, MIT license`) and preserve the license header if copying a full file.

Multi-step agent tool-call chains are the highest-hallucination-risk surface in current systems (independent 2026 benchmarks put ungrounded chains at 20–40% error rates on non-trivial steps). This project's entire purpose is agentic multi-file work — treat grounding as a correctness requirement, not a style preference.

## 1. Project overview

A desktop AI-native code editor, forked from an existing open-source VS Code derivative, wired to an agentic backend capable of multi-file refactoring with full-project context awareness, persistent cross-session memory/skills, and a pluggable tool layer via MCP. Full architecture and source-repo rationale is in `AI-IDE-Research-and-Architecture.md` in this same directory — **read that file before starting**, it names the exact upstream repos for every subsystem below.

## 2. Where each subsystem's real source lives — go read it, don't guess

| Subsystem | Do not reimplement from scratch — go read | What to look at specifically |
|---|---|---|
| Editor shell / UI | `github.com/voideditor/void` | It's a VS Code fork — check `VOID_USEFUL_LINKS.md` in that repo for the VS Code internals it depends on before touching editor-core code |
| Agent orchestration / sandboxing | `github.com/All-Hands-AI/OpenHands` | The `Workspace` abstract class and its Local/Docker/Remote implementations; the event-sourced state model (`MessageEvent`, `ActionEvent`, `ObservationEvent`, `Condensation`) |
| Reasoning engine | Anthropic's Claude Agent SDK docs (search `docs.claude.com` — do not assume the API shape, it changes) | `ClaudeAgentOptions`, `query()` vs `ClaudeSDKClient`, hooks (`PreCompact`/`PostCompact`), subagent spawning |
| Codebase indexing / repo map | `github.com/Aider-AI/aider` → `aider/repomap.py`, or the standalone `github.com/pdavis68/RepoMapper` | The tree-sitter tag extraction, the PageRank graph construction, and the binary-search token-budgeting step — these are specific, tested algorithms, not something to reinvent |
| Memory & self-improving skills | `github.com/NousResearch/hermes-agent` | The skill-creation/skill-reuse loop and the FTS5 cross-session recall implementation |
| MCP tool catalog | Hermes Agent's vetted MCP catalog (referenced in its release notes — search for it) and the official `modelcontextprotocol.io` spec | Don't hand-roll a tool registry format; MCP already defines one |
| (v2) Remote gateway | `github.com/openclaw/openclaw` | The Gateway control-plane pattern, only when this phase is reached |
| Symbol-level semantic editing | `github.com/oraios/serena` | The MCP tool set (`find_symbol`, `find_referencing_symbols`, `insert_after_symbol`) — use these for renames/moves instead of hand-rolled search-and-replace |
| Structural search/rewrite | `github.com/ast-grep/ast-grep` | Pattern syntax (`$VAR`, `$$$` wildcards) for bulk structural rewrites — check current docs before writing a pattern, the syntax is specific and not guessable |

If a task touches one of these subsystems and the upstream repo hasn't been cloned/vendored into this project yet, **search for it and read the current source before implementing**, even if you're confident you remember roughly how it works. Confidence is not verification — these projects update constantly and specifics (method names, config formats, CLI flags) drift.

## 2a. Model in use: Gemini 3.6 Flash (High reasoning) — what this changes

This project is primarily being coded by **Gemini 3.6 Flash running at the "High" thinking level**, not Claude. This has concrete consequences for how you should operate, not just which API you call:

- **Always use High reasoning effort for anything touching more than one file.** Gemini 3.6 Flash's reasoning level is explicitly configurable (minimal/low/medium/high), and the step up in reasoning depth is specifically what improves multi-step correctness on refactor-shaped tasks. Dropping to a lower level to save time/tokens on a multi-file change is a false economy for this project — verification cost from a wrong edit is higher than the extra reasoning tokens.
- **Because the reasoning-engine choice is Gemini, do not build against the Claude Agent SDK as the orchestration layer** — it is Claude-only. Use the **OpenHands Agent SDK** path from the architecture doc (§3, Option B), which is model-agnostic via LiteLLM and can call Gemini directly. This was already the recommended default for exactly this reason; it's now a hard requirement, not a preference.
- **The 1M-token context window is generous, but output is metered per-token and isn't free** — don't use the large window as an excuse to skip the repo-map/context-selection step in §2. Send the ranked, budgeted context (Aider repo map + Serena symbol lookups), not the whole repository, even though it would technically fit.
- **Lean on the model's own action-bias reduction, don't fight it.** Gemini 3.6 Flash is specifically tuned to resolve read-only/diagnostic tasks without making unsolicited edits. If a task is exploratory ("find where X is defined," "check if Y is still used anywhere"), do not turn it into an edit unless the task actually asked for one — this matches both the model's design and this project's diff-review-first UX.
- **Model behavior details (exact parameter names, thinking-level API syntax, tool-calling format) drift between releases — verify against the current Gemini API docs (`ai.google.dev/gemini-api/docs`) before hardcoding a request shape**, same as §0 requires for everything else. Do not assume this file's description of the model is still current by the time you're implementing against it; re-check.

## 3. Setup, build, and test commands

> This section must be kept accurate and filled in as the project is scaffolded. **Do not leave placeholder commands that don't actually work** — if a command below hasn't been verified against the real project structure yet, mark it `TODO: verify` rather than guessing.

- Install: `TODO: verify`
- Build: `TODO: verify`
- Run dev build: `TODO: verify`
- Run tests: `TODO: verify`
- Lint/typecheck: `TODO: verify`

Whoever (human or agent) sets up the initial toolchain must replace these with the real, run-and-confirmed commands immediately — an agent reading a stale command here will waste a session debugging a command that was never correct.

## 3a. Code style rules (mandatory, all languages)

These apply to every file you write in TypeScript, Python, and Rust alike.

1. **Comment sparingly, but comment well.** Do not narrate obvious code line-by-line. Add a comment only where the logic is genuinely non-obvious — an algorithm choice, a workaround for a library quirk, a non-standard ordering that matters, a security/correctness constraint. Where you do comment, write a real explanation (a sentence or two of *why*, not just *what*) rather than a one-word tag. A file with zero comments on tricky logic is as wrong as a file with a comment on every line.
2. **Minimize explicit type annotations; use them when they earn their place.** Prefer inference (TypeScript) and Python's own inference/duck typing where the type is obvious from context. Do add explicit types at: public function/API boundaries, complex data structures, anywhere ambiguity could cause a real bug, and anywhere a reader (human or another agent) would otherwise have to trace call sites to know what a value is. Never use `any` in TypeScript as a substitute for figuring out the real type — if the real type is genuinely unknown or dynamic, use `unknown` and narrow it.
3. **Write effective code, not clever code.** Prefer the straightforward implementation over a dense one-liner. Avoid premature abstraction — don't build a plugin system for something used once. Match the style already present in whichever upstream repo a file was forked/ported from (Void's existing TS conventions, Aider's Python conventions, etc.) rather than imposing a different personal style on borrowed code.
4. **No emoji, anywhere** — not in code, not in comments, not in commit messages, not in docs or UI strings, unless the human owner explicitly asks for one in a specific spot.
5. **Source before writing, always** (restates §0, non-negotiable): if a real open-source implementation of what you're about to write exists — even partially — go get it, adapt it, and cite it. Only write original code for the genuinely novel glue logic that connects these existing systems together. If you catch yourself about to write a non-trivial algorithm (parsing, ranking, graph traversal, diffing) from scratch, stop and search first.

## 4. Non-standard project conventions

> Fill this in as real conventions emerge. Do not pre-fill this with generic best practices — per 2026 research on AGENTS.md effectiveness, generic advice and architecture-overview prose measurably *reduce* agent performance by inflating context without adding decision-relevant information. Only list things here that are **non-obvious and would otherwise cause a wrong guess**: hard version pins, repo-specific naming quirks, anything that deviates from the upstream project it was forked from.

- (none recorded yet)

## 5. Verification requirements before considering a task done

1. **Run it, don't assert it.** If you claim tests pass, you must have actually run the test command and seen the output — never state "this should work" as a substitute for running it.
2. **Multi-file changes require checking the repo map / dependency graph** (see §2) for what else references the changed symbol, before declaring the change complete.
3. **Cite what you sourced.** In the PR/commit description, note which upstream repo(s) you pulled logic or patterns from for this change, if any.
4. **If uncertain, stop and flag it** rather than shipping a guess. A clearly-marked `UNVERIFIED` block the human can review is far cheaper to fix than a confidently wrong implementation buried in a large diff.

## 6. License compliance

All primary source repos referenced in §2 are MIT-licensed as of this writing (re-verify the LICENSE file of each before vendoring, licenses can change). When copying substantial code rather than reimplementing a described algorithm, preserve the original license header and add an attribution comment per §0.5.
