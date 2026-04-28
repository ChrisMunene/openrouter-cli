## Context

`cli-openrouter` is a greenfield TypeScript CLI: an interactive agent that chats with a model on OpenRouter and edits local files. The proposal lays out *what* foundation we are building; this document records *how* we are building it and, more importantly, *why we picked these choices over the obvious alternatives*. Every later change to this CLI will plug into the registries, permission model, and entrypoint shape decided here, so getting these decisions explicit before code is written is the whole point.

Constraints that shape the design:

- Single-user, local-only; no server, no auth surface beyond the OpenRouter API key.
- Node 20+ on macOS/Linux. Distributed as one binary, `or`.
- All v1 traffic flows through OpenRouter — provider routing is not our concern.
- The user has hands-on terminal control, so when in doubt we prefer prompting them over silent magic.

## Goals / Non-Goals

**Goals**

- A single, obvious entrypoint (`src/index.ts`) that does dispatch and nothing else.
- A REPL that runs an agentic turn (model ↔ tools, multiple iterations) per user line.
- Two clean extensibility seams — slash commands and model tools — that future changes drop into without touching the loop.
- A risk-tiered permission gate that makes destructive actions visible without paralyzing the agent.
- Model selection that "just works" out of the box and is trivially swappable mid-session across six hardcoded IDs.
- Project memory loaded from a conventional file (`AGENTS.md` / `OR.md`) without a separate config step.

**Non-Goals**

- Persistence of any kind (sessions, history, caches). In-memory only.
- Markdown rendering, streaming animations, or any TUI polish.
- Dynamic model discovery against the OpenRouter `/models` endpoint.
- Cost/token accounting.
- Plugin loading for third-party slash commands or tools.
- Sandboxing the `bash` tool.

## Decisions

### 1. Vercel `ai` SDK with `@openrouter/ai-sdk-provider`, not the raw `openai` SDK

We use `streamText({ model, messages, tools, stopWhen })` from the Vercel `ai` SDK. The SDK ships a built-in agentic loop: when the model emits tool calls, the SDK invokes our handlers, feeds results back, and continues until the model returns text — exactly the loop we'd otherwise hand-roll.

**Why over alternatives**:
- *Vanilla `openai` SDK pointed at OpenRouter*: requires us to write the tool-call iteration ourselves. Workable, but the loop has subtle correctness traps (parallel tool calls, error propagation, stop conditions) we'd rather inherit than re-implement.
- *Raw `fetch` against OpenRouter*: maximum control, maximum boilerplate. Not justified for v1.

**Trade-off**: the SDK abstracts the loop, so we have less control over per-iteration introspection (e.g., showing the user "thinking…" between tool calls). We accept this for v1; if we need finer-grained UX later, the `ai` SDK exposes lower-level primitives we can drop down to without rewriting.

### 2. Single entrypoint at `src/index.ts`, dispatch only

The entrypoint is small and boring. It parses argv into one of three shapes and hands off:

```
or                       → startChat(...)        // REPL
or "<prompt>"            → runOneShot(...)       // single turn, prints, exits
or config <subcommand>   → runConfigCommand(...) // utility
```

**Why over alternatives**:
- *Subcommand-first design (`or chat`, `or run`)* — more "correct" CLI shape, but the most common verb is "talk to the model," and forcing `or chat` for the default path adds friction without a payoff.
- *Two binaries (`or` interactive, `or-run` one-shot)* — splits surface area for a feature most users will use both halves of. Not worth it.

The cost of bare-prompt dispatch is having to disambiguate `or "config something"` from `or config <sub>`. The disambiguator: subcommands are a fixed, known set (`config` is the only one in v1) — if `argv[0]` matches a subcommand name, it's a subcommand; otherwise it's a prompt.

### 3. Two registries, separate trust models

We maintain two `Map<string, …>` registries:

- `slashCommands` in `src/slash/` — keyed by the literal name without the slash. Only invoked by user-typed input that begins with `/`. **Trusted** (the user is typing them).
- `tools` in `src/tools/` — keyed by tool name. Only invoked by the model. **Untrusted** by default; gated by `risk` tier.

**Why separate**: same shape, different invariants. Slash commands need access to mutable session state (history, current model, exit signaling). Tools need argument schemas (Zod), structured results, and risk classification. Forcing them into one abstraction would either bloat slash commands with unused fields or weaken tools' typing.

### 4. Risk-tiered permission gate

Each tool declares `risk: 'safe' | 'write' | 'exec'`. The permission gate consults the tier before invoking:

| Tier | Examples | Default behavior | With `--yolo` |
|---|---|---|---|
| `safe` | `read_file`, `list_dir` | Run silently | Run silently |
| `write` | `write_file`, `edit_file` | Prompt: "Allow write to <path>? [y/N]" | Run silently |
| `exec` | `bash` | Prompt: "Allow command: <cmd>? [y/N]" | Run silently |

**Why over alternatives**:
- *Per-tool allow/deny config*: more flexibility, more configuration burden. Three tiers is enough granularity for v1; tools can be re-tiered later without touching the gate.
- *No prompts, just `--yolo` or nothing*: too coarse — users want guardrails on writes/exec by default, but reads being silent is what makes the agent feel responsive.
- *Per-call vs. session-scoped approval*: per-call, always. Session-scoped "always allow" turns the gate into a single careless `Enter` press that defangs the whole model. We can revisit if friction becomes intolerable.

### 5. Six hardcoded models, two tiers per provider

```ts
// src/llm/models.ts
export const MODELS = {
  'openai/gpt-5.4-nano':         { tier: 'speed',    provider: 'openai' },
  'openai/gpt-5.4-mini':         { tier: 'reliable', provider: 'openai' },
  'anthropic/claude-haiku-4.5':  { tier: 'speed',    provider: 'anthropic' },
  'anthropic/claude-sonnet-4.6': { tier: 'reliable', provider: 'anthropic' },
  'google/gemini-2.5-flash-lite':{ tier: 'speed',    provider: 'google' },
  'google/gemini-2.5-flash':     { tier: 'reliable', provider: 'google' },
} as const
```

Default boot model: `anthropic/claude-haiku-4.5` — Haiku has the most reliable tool-calling in the speed tier across our experience, which matters since the entire CLI rides on tool calls.

**Why hardcoded**: the OpenRouter catalog has hundreds of models; presenting all of them via `/model` is a bad menu. A curated six gives users a real choice (latency vs. reliability across three families) with zero network dependency at startup. Dynamic discovery is a known follow-up change, not a v1 feature.

**Why this exact six**: each provider's smallest "speed" tier is what to reach for during interactive iteration; the "reliable" tier is the escape hatch when speed-tier brittleness on agentic loops bites. One file, one constant, easy to swap.

### 6. Permission prompts, model output, and slash commands all share one IO surface

The chat loop owns a `readline` interface for input. Permission prompts during a tool call also use it (synchronously paused). Slash commands and tool output all write to `process.stdout` via the same render helper. There is no separation between "agent output" and "permission prompts" because the user's mental model is one terminal — we don't need to invent a TUI yet.

### 7. Project memory: `AGENTS.md` first, `OR.md` second

On startup, `loadConfig` checks the working directory for `AGENTS.md`, then `OR.md`. The first one found is read and prepended to the system prompt under a clearly delimited section. We pick `AGENTS.md` first because it's the emerging cross-tool convention (Codex, several open agents) — being friendly to that convention is free.

**Non-decision**: we do *not* recursively walk up parent directories looking for memory files, and we do *not* concatenate them. One file, in CWD, full content. Recursive merge has compounding edge cases (priorities, conflict resolution) that aren't worth it before we've felt the pain.

### 8. Configuration: env var required, file optional

```
OPENROUTER_API_KEY  (required, env)
~/.config/or/config.json  (optional)
  └─ { "default_model": "<model-id>" }
```

API key only via env var — never written to disk by us. The config file's only v1 job is overriding the boot default model. The CLI fails fast at startup if `OPENROUTER_API_KEY` is missing, with a one-line error pointing at how to set it.

### 9. Streaming: stream the final text, block on tool-call decisions

The Vercel `ai` SDK can stream tokens as they arrive. We render the model's *text deltas* as they stream, but we *block rendering* between tool calls — we don't try to interleave "model said X" / "called Y" / "got Z" / "model said W" mid-stream. Cleaner output, simpler control flow, and we still get the perceived liveness benefit during the actual final response.

## Risks / Trade-offs

- **The `bash` tool runs unsandboxed** → mitigated only by the per-call permission prompt. A user who reflexively presses `y` will hand the model arbitrary shell access. We accept this for v1; sandboxing is a known follow-up.
- **The Vercel `ai` SDK abstracts the agentic loop** → if we ever need fine-grained per-iteration UX (per-tool spinners, partial result streaming through tool calls), we'll have to drop to lower-level SDK primitives or migrate. Likelihood low for v1, but flagged.
- **Speed-tier models are brittle on multi-tool agentic loops** → mitigated by including the "reliable" tier in the hardcoded list. The fix when speed tier misbehaves is `/model anthropic/claude-sonnet-4.6`, not a code change.
- **Hardcoded model list will go stale** → mitigated by it being a single const file. Dynamic discovery is the explicit follow-up.
- **`edit_file` requires `old_string` to be unique in the file** → tools that rely on string-match editing have well-known failure modes (whitespace drift, ambiguous matches). Mitigation: tool returns a clear, structured error to the model when the match is non-unique or absent, so the model can recover (re-read and retry with more context).
- **No conversation persistence** → if the process crashes mid-task, work is lost. Acceptable for v1: the alternative (designing a persistence layer correctly) is a real change of its own and shouldn't ride along here.
- **Unified IO surface (no TUI separation)** → permission prompts arriving mid-stream could be visually noisy when we eventually add streaming. Today's resolution: streaming pauses while a prompt is open. Re-evaluate if it becomes intrusive.
