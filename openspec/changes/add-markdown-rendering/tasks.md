## 1. Dependencies

- [x] 1.1 Add runtime dependencies: `marked`, `marked-terminal`, `cli-highlight`
- [x] 1.2 Add dev dependencies for type stubs as needed (`@types/marked-terminal` if available; otherwise declare local module shim)
- [x] 1.3 Run `npm install` and confirm peer-dep compatibility with the existing `ai` v6 / Node 20 stack

## 2. Renderer Module

- [x] 2.1 Create `src/render/markdown.ts`
- [x] 2.2 Configure `marked` with the `marked-terminal` renderer at module load (single shared instance)
- [x] 2.3 Wire the renderer's `code` callback to `cli-highlight` so fenced code blocks are syntax-highlighted by language; fall back to unhighlighted when language is missing or unknown without throwing
- [x] 2.4 Export `renderMarkdown(text: string): string` — pure function, takes markdown, returns ANSI-decorated string
- [x] 2.5 Export `isTtyOutput(): boolean` returning `process.stdout.isTTY === true`
- [x] 2.6 Export `getRenderWidth(): number` returning `Math.min(process.stdout.columns ?? 80, 100)`; pass into the renderer's width option

## 3. Indicator Module

- [x] 3.1 Create `src/render/indicator.ts` with no external dependencies
- [x] 3.2 Export an `Indicator` class (or factory) with `start()`, `stop()`, `pause()`, `resume()`
- [x] 3.3 `start()` records turn-start time and registers a `setInterval` that does NOT print until a ~250ms grace period has elapsed; thereafter writes a single overwriting line via `cursorTo(0)` + `clearLine(0)` + spinner glyph + ` thinking… Ns`
- [x] 3.4 `stop()` clears the interval AND clears the line (so no spinner artifact remains) and returns the cursor to column 0
- [x] 3.5 `pause()` clears the interval and clears the line; `resume()` restarts the interval (reusing the original start time so the elapsed counter continues from where it was)
- [x] 3.6 All methods are idempotent — calling `pause()` twice or `stop()` after `pause()` MUST NOT throw or leave artifacts on screen
- [x] 3.7 Honor TTY: if `isTtyOutput()` is false, `start()` is a no-op and the other methods are no-ops too

## 4. Wire ChatContext

- [x] 4.1 In `src/chat/loop.ts`, extend `ChatContext` with `pauseIndicator(): void` and `resumeIndicator(): void`
- [x] 4.2 In `runAgenticTurn()`, instantiate an `Indicator`, call `start()` before the SDK call, store its `pause` and `resume` methods on `ctx.pauseIndicator` / `ctx.resumeIndicator`
- [x] 4.3 In `startChat()` and `runOneShot()` (outside an active turn), set `ctx.pauseIndicator` and `ctx.resumeIndicator` to no-op functions so the permission gate can call them safely if invoked

## 5. Replace Streaming Write with Buffer + Render

- [x] 5.1 In `runAgenticTurn()`, replace the `for await (chunk of result.textStream) stdout.write(chunk)` loop with `let buffered = ''; for await (chunk of result.textStream) buffered += chunk`
- [x] 5.2 After the loop completes, stop the indicator and clear its line
- [x] 5.3 If `isTtyOutput()` is true and `buffered` is non-empty, write `renderMarkdown(buffered)` followed by a trailing newline if not already present
- [x] 5.4 If `isTtyOutput()` is false, write `buffered` raw (followed by a trailing newline if not present)
- [x] 5.5 Wrap the entire turn in `try { ... } finally { indicator.stop() }` so the indicator is always cleaned up
- [x] 5.6 In the `catch` branch for SDK errors, render the buffered partial text first (via the same TTY path) and then emit the error message as plain text via `console.error`

## 6. Permission Gate Integration

- [x] 6.1 In `src/tools/permission.ts`, before calling `ctx.rl.question(prompt)` for `write`/`exec` tiers, call `ctx.pauseIndicator()`
- [x] 6.2 Wrap the `rl.question` call in `try / finally` so `ctx.resumeIndicator()` is always called after the user answers, even if the prompt is interrupted
- [x] 6.3 Confirm by inspection that the `serialize()` mutex is unaffected — pause/resume happens inside the serialized critical section

## 7. README Update

- [x] 7.1 Add a short note to `README.md` explaining that model output is rendered as markdown in TTY mode and emitted raw when piped, with one-line examples of each

## 8. Smoke Verification

- [ ] 8.1 Manual: in an interactive REPL, ask the model for a response containing headings, bold, lists, and a fenced ` ```ts ` code block; confirm rendered output is readable with ANSI styling and syntax-highlighted code
- [ ] 8.2 Manual: `or "respond in markdown with a heading and a code block" > out.md` — open `out.md`, confirm raw markdown (no ANSI) and no spinner artifacts
- [ ] 8.3 Manual: trigger a write_file permission prompt in the middle of a long turn; confirm the spinner pauses cleanly, the prompt renders without overwrites, and the spinner resumes after the answer
- [ ] 8.4 Manual: shell out to a fast turn (e.g. simple greeting) — confirm no spinner flashes for sub-second responses (grace period works)
- [ ] 8.5 Manual: simulate a long turn (~5+ seconds) — confirm spinner shows elapsed seconds and clears completely before the rendered output appears
- [ ] 8.6 Manual: resize the terminal narrower mid-session, then issue a new prompt — confirm new render uses the new width
- [ ] 8.7 Manual: run on an ultra-wide terminal — confirm prose paragraphs cap at 100 columns
