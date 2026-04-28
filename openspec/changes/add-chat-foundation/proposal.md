## Why

There is no working CLI yet — only OpenSpec scaffolding. To make any future change useful, we need a runnable foundation: a binary the user can launch, a chat REPL that talks to OpenRouter, and the two extensibility seams (slash commands the user types and tools the model calls) that every later change will plug into. Picking the architecture once now — rather than letting it congeal change-by-change — keeps the agentic loop, the registries, and the permission model coherent from day one.

## What Changes

- Introduce a single TypeScript entrypoint (`src/index.ts`) exposed as the binary `or` that dispatches between an interactive REPL, a one-shot prompt mode, and the `or config` utility.
- Implement the chat REPL with an agentic turn (model → tool calls → results → model …) using the Vercel `ai` SDK with the `@openrouter/ai-sdk-provider`.
- Introduce a **slash command registry** (`src/slash/`) populated with `/help`, `/exit`, `/clear`, `/model`, `/tools`.
- Introduce a **model-tool registry** (`src/tools/`) populated with `read_file`, `list_dir`, `write_file`, `edit_file`, `bash`. Each tool declares a `risk` tier (`safe` | `write` | `exec`).
- Add a **risk-tiered permission gate**: `safe` runs silently; `write` and `exec` prompt the user before each invocation unless the session was started with `--yolo`.
- Hardcode six selectable models (two tiers × OpenAI/Anthropic/Google) in `src/llm/models.ts`. Default boot model: `anthropic/claude-haiku-4.5`.
- Read configuration from `OPENROUTER_API_KEY` (required) and an optional `~/.config/or/config.json` (default model).
- On startup, if `AGENTS.md` or `OR.md` exists in the working directory, prepend it to the system prompt as project memory.

Out of scope (deferred to later changes): conversation persistence, terminal markdown rendering, dynamic model fetching from the OpenRouter API, streaming UX polish, cost/token tracking, third-party plugins, sandboxed `bash` execution.

## Capabilities

### New Capabilities
- `chat`: The CLI's chat surface and execution model — entrypoint dispatch, REPL, agentic turn via the Vercel `ai` SDK, slash command registry, model-tool registry, risk-tiered permission gate, model selection across the six hardcoded IDs, and project-memory loading from `AGENTS.md`/`OR.md`. The five v1 tools and five v1 slash commands are the initial population of the registries this capability defines.

### Modified Capabilities
<!-- None — this is a greenfield project; no existing specs to modify. -->

## Impact

- **Code (new)**: `src/index.ts`, `src/chat/loop.ts`, `src/llm/{client,models}.ts`, `src/tools/{registry,permission,read-file,list-dir,write-file,edit-file,bash}.ts`, `src/slash/{registry,commands}.ts`, `src/config/load.ts`.
- **Build / packaging**: new `package.json` with the `or` bin, `tsconfig.json`, `tsx` for dev runs, `typescript` for compilation. Node 20+ required.
- **Dependencies (new)**: `ai` (Vercel AI SDK), `@openrouter/ai-sdk-provider`, `zod` (tool argument schemas), and a small arg-parser (e.g. `mri`). Dev: `typescript`, `tsx`, `@types/node`.
- **Runtime requirements**: `OPENROUTER_API_KEY` env var must be set. Filesystem access for read/write tools. Shell access for `bash` tool.
- **User-visible surface**: a new binary `or` with three invocation modes (`or`, `or "<prompt>"`, `or config ...`).
- **Security**: the `bash` tool can execute arbitrary shell commands; the permission gate is the only barrier in v1. Sandboxing is explicitly deferred.
- **No migrations, no breaking changes** — greenfield.
