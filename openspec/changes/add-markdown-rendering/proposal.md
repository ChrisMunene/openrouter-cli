## Why

The `add-chat-foundation` change explicitly deferred terminal markdown rendering — the agent works, but the model's output (which is markdown by default) appears with literal `**`, `#`, and code-fence markers. This is the difference between text the user can read and text the user has to mentally parse. Now that the foundation runs end-to-end, finishing the rendering layer is the obvious next quality-of-life improvement.

## What Changes

- Replace the per-chunk write in `runAgenticTurn()` with a buffer-then-render flow: collect the full text response, then render once at the end of the turn via `marked-terminal`.
- Add a lightweight ASCII spinner with elapsed-seconds counter that runs while the model is streaming. Appears after a short grace period so sub-second turns don't flicker. Clears cleanly before the rendered output prints.
- Wire spinner pause/resume through `ChatContext` so the permission gate can suppress the spinner during `[y/N]` prompts and resume it afterward.
- Add `cli-highlight`-driven syntax highlighting for fenced code blocks; the fence info string (e.g. ` ```ts `) drives language detection.
- Detect TTY: when `process.stdout.isTTY` is false (output piped/redirected), emit raw markdown straight through with no spinner and no ANSI.
- Honor `process.stdout.columns` for soft-wrapping, with a 100-column soft cap so prose stays readable on ultra-wide terminals.

Out of scope (deferred): tool-call activity narration in the spinner (e.g. `→ read_file → 412 bytes`), token-count display, color theme customization, a `--no-render` flag, live re-render on terminal resize, block-level streaming.

## Capabilities

### New Capabilities
<!-- None — this change extends an existing capability. -->

### Modified Capabilities
- `chat`: gains requirements covering output rendering — buffer-and-render pipeline, TTY-aware behavior, syntax highlighting, width handling, and the activity indicator with spinner pause/resume around permission prompts.

## Impact

- **Code (new)**: `src/render/markdown.ts` (renderer + TTY detection + width policy), `src/render/indicator.ts` (no-dep spinner with start/stop/pause/resume).
- **Code (modified)**: `src/chat/loop.ts` — `runAgenticTurn()` swaps streaming write for buffer + indicator + render; `ChatContext` adds `pauseIndicator()` / `resumeIndicator()` (no-op when no indicator is active). `src/tools/permission.ts` — calls `ctx.pauseIndicator()` before the `[y/N]` prompt and `ctx.resumeIndicator()` after.
- **Dependencies (new)**: `marked`, `marked-terminal`, `cli-highlight`. All small, all CommonJS-friendly with NodeNext.
- **User-visible surface**: terminal output for model responses changes substantially (rendered markdown vs. raw). Slash commands, permission prompts, banners, and error messages remain plain text.
- **Performance**: a one-pass `marked` parse + render on the buffered string (typically a few KB). Negligible.
- **No API changes, no breaking changes for non-TTY consumers** — piped output remains raw markdown.
