## Context

The `add-chat-foundation` change shipped a working agentic CLI that streams the model's text directly to stdout, with markdown markers (`**`, `#`, ` ``` `) appearing literal in the terminal. The non-goal there was deliberate — markdown rendering interacts with streaming, permission prompts, and TTY detection in ways worth designing rather than improvising. This change is that design, made concrete.

The render scope is **only the model's text output** for an agentic turn. CLI chrome — banners, slash command output, permission prompts, errors — stays plain text and bypasses the renderer entirely.

## Goals / Non-Goals

**Goals**

- Model responses display as rendered markdown in TTY mode, with bold, headings, lists, links, blockquotes, and syntax-highlighted code fences.
- Output is unchanged when piped or redirected: raw markdown, no ANSI, no spinner.
- A live indicator tells the user the model is working during the buffering phase, so the absence of streaming text doesn't feel like the CLI is hung.
- Permission prompts continue to work cleanly — the spinner steps aside while a `[y/N]` is open and resumes after.
- Width adapts to the terminal but doesn't run prose to 240 columns on ultra-wide displays.

**Non-Goals**

- Block-level streaming. We choose simplicity over liveness for v1.
- Tool-call activity narration. Belongs in a separate change so this one stays scoped to rendering.
- Configurable themes, per-element color customization, alternate renderers. One reasonable default.
- A `--no-render` opt-out flag. Pipe detection covers the legitimate "I want raw markdown" case.
- Token-count display in the indicator (would couple to SDK internals; defer).
- Re-rendering on terminal resize during a turn.

## Decisions

### 1. Buffer-and-render, not block-level streaming

`runAgenticTurn()` collects the full final text from the SDK's stream into a string, then renders once. Implementation can use either `result.text` (a Promise) or accumulate from `result.textStream` — picking the latter so we still have the option to add token-level UX later without changing this site.

**Why over alternatives**:
- *Block-level streaming* (flush per paragraph or per closed fence): gives a more "alive" feel but requires a parser-aware buffer that knows when a block has closed. Code fences spanning many tokens are the worst case. The cost of edge cases doesn't pay off here because typical agentic-turn responses are short.
- *Stream raw, re-render at end* (clear and replace): visually disruptive — the user reads the same content twice in different forms.

**Consequence**: the user waits silently for the duration of the agentic turn unless we show a progress indicator. Indicator is therefore mandatory, not optional.

### 2. `marked` + `marked-terminal` + `cli-highlight`

`marked` parses; `marked-terminal` provides an ANSI-emitting renderer plugin; `cli-highlight` provides syntax highlighting for fenced code, slotted in via the `code` callback. All three are small, mature, and active. No transitive bloat.

**Why over alternatives**:
- *Hand-rolled regex-based renderer*: passable for `**bold**` and `` `inline code` `` but rapidly painful for nested lists, blockquote nesting, and especially syntax-highlighted fences. Wrong scope.
- *`ink` or other React-for-CLI*: an entire framework when we want a pure-string transform. Massive over-engineering.
- *External tools (`glow`, `bat`)*: introduces a runtime dependency on a binary that may not be installed.

### 3. TTY detection at the call site

`isTtyOutput()` returns `process.stdout.isTTY === true`. When false (piped or redirected), `runAgenticTurn` emits the buffered text **raw** — no markdown rendering, no spinner. This is the standard CLI pattern and lets users do `or "..." > out.md` without ANSI noise polluting the file.

**Why over alternatives**:
- *Always render, never plain-pipe*: breaks pipelines and any consumer that wants the raw markdown.
- *Render-with-flag (`--render` / `--no-render`)*: introduces yet another flag for behavior that should be inferred from context. The `isTTY` heuristic is correct in 100% of cases that matter here.

### 4. Indicator: minimal spinner with elapsed seconds

A small ASCII spinner (`⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏` or fallback `-\\|/`) plus an elapsed-seconds counter (`thinking… 2s`). No external dep — `setInterval` writes a single overwriting line via `process.stdout.cursorTo(0)` + `process.stdout.clearLine(0)`. Implementation lives in `src/render/indicator.ts`.

**Decisions inside the indicator**:
- **Grace period**: spinner doesn't appear for the first ~250ms. Keeps fast turns from flashing a spinner that users barely see.
- **Cleanup on completion**: `clearLine` + `cursorTo(0)` before the rendered output starts so the spinner line is replaced cleanly.
- **Pause / resume** through `ChatContext`: `ctx.pauseIndicator()` stops the interval and clears the spinner line; `ctx.resumeIndicator()` restarts it. No-ops when not in TTY mode or when the indicator hasn't been started.
- **Single instance per turn**: started in `runAgenticTurn` before the `for await` begins, stopped in a `finally` block. The pause/resume calls from the permission gate operate on this single instance.

**Why no library** (`ora`, `nanospinner`): we control timing and cleanup ourselves, including the pause/resume integration with the permission gate. A 30-line implementation is simpler than configuring someone else's API to do the same.

### 5. Width: terminal columns, soft-capped at 100

`marked-terminal` accepts a `width` option. We pass `Math.min(process.stdout.columns ?? 80, 100)` so:
- Narrow terminals get exactly their width.
- Standard 80–100 column terminals get their width.
- Ultra-wide terminals (200+) cap at 100 — keeps prose readable as paragraphs rather than single long lines. Tables and code blocks may exceed the cap; that's acceptable.

**Why this rule**: the cap mirrors common typography practice (~75 characters per line for body text). 100 is generous but not absurd. We resolve once at render time; we do not re-render on resize.

### 6. Permission prompts ↔ spinner coordination

The permission gate already lives at `src/tools/permission.ts`. It currently calls `ctx.rl.question(prompt)`. The change here:

```
checkPermission(...):
  if safe or yolo → allow
  ctx.pauseIndicator()           // stop the spinner cleanly
  try:
    answer = await ctx.rl.question(prompt)
    return decision based on answer
  finally:
    ctx.resumeIndicator()         // restart spinner
```

`pauseIndicator` and `resumeIndicator` live on `ChatContext` and are wired by `runAgenticTurn` to point at the per-turn indicator instance. Outside an agentic turn (or in non-TTY mode), they're no-ops.

**Why on ChatContext rather than a global**: lets `runAgenticTurn` own the indicator's lifecycle (start/stop) while exposing a controlled surface to callers that need it. Avoids a module-level singleton, which would complicate testing and concurrent-tool-call coordination.

### 7. Renderer is configured once at module load

`marked-terminal`'s setup (color choices, `code` callback wired to `cli-highlight`, list bullets) is configured once when `src/render/markdown.ts` is imported. `renderMarkdown(text)` is then a pure function: input markdown string, output ANSI-decorated string. No mutable state.

### 8. Errors and partial output

If the SDK throws mid-stream, we still render whatever was buffered (so the user gets the partial response) and then print the error in plain text below it. The current `try/catch` in `runAgenticTurn` already catches; this change only changes what happens on the success path. Indicator is stopped in `finally` regardless.

## Risks / Trade-offs

- **Lost streaming feel** → mitigated by the spinner + elapsed counter. For longer turns (5s+) the indicator carries the UX. For short turns (<1s) the grace period prevents flicker.
- **`marked-terminal` rendering quirks on edge cases** (nested lists, mixed list/code) → known territory. Configurable per-element if we hit something offensive. Mitigation lives in `markdown.ts`, not at the call site.
- **Spinner ↔ readline interaction on the same stdout** → the readline used for permission prompts shares stdout with the spinner. Without pause/resume the prompt would be overwritten by the next spinner tick. We handle this explicitly via `pauseIndicator()` / `resumeIndicator()` — see Decision 6.
- **Concurrent permission prompts during parallel tool calls** → already serialized via the `promptChain` mutex in `permission.ts`. Each pause/resume nests cleanly because pause is idempotent and resume is paired.
- **`process.stdout.columns` is `undefined` in some environments** → fallback to 80. Captured at render time, not at startup, so it reflects the current terminal.
- **No `--no-render` flag** → if a user really wants raw markdown to a TTY, they can `or "..." | cat`. Acceptable v1 trade-off.
- **Three new deps** → small, but non-zero. We accept this as the cost of not hand-rolling.
