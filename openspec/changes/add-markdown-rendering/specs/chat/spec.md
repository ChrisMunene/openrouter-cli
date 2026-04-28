## ADDED Requirements

### Requirement: Buffered Markdown Rendering of Model Output

During an agentic turn, the CLI SHALL buffer the model's text response in full and render it once at the end of the turn. The renderer MUST treat the buffered string as markdown and emit ANSI-decorated output appropriate for a terminal. CLI chrome (banners, slash command output, permission prompts, error messages) MUST bypass the renderer and remain plain text.

#### Scenario: Buffered text is rendered at end of turn
- **WHEN** the agentic turn completes and the buffered model output contains markdown elements such as `**bold**`, `# heading`, or fenced code blocks
- **THEN** those elements are rendered as ANSI-decorated text before the next prompt is shown

#### Scenario: Slash command output is not rendered
- **WHEN** a slash command (e.g. `/help`, `/tools`, `/model`) emits output
- **THEN** the output is printed as plain text and is NOT processed by the markdown renderer

#### Scenario: Permission prompt is not rendered
- **WHEN** the permission gate prompts the user `Allow? [y/N]`
- **THEN** the prompt is printed as plain text and is NOT processed by the markdown renderer

### Requirement: TTY-Aware Output

The renderer SHALL detect whether stdout is a TTY at render time. When stdout is a TTY, output MUST be ANSI-decorated. When stdout is NOT a TTY (piped or redirected), the buffered model output MUST be emitted as raw markdown unchanged, and no spinner MUST be displayed.

#### Scenario: TTY output is rendered with ANSI
- **WHEN** the user runs the CLI in an interactive terminal
- **THEN** model output is emitted with ANSI escape sequences for headings, bold, code, etc.

#### Scenario: Piped output is raw markdown
- **WHEN** the user runs `or "..." > out.md` or `or "..." | grep ...`
- **THEN** the model's response is written to stdout as raw markdown with no ANSI escape sequences and no spinner

### Requirement: Activity Indicator During Buffering

In TTY mode, the CLI SHALL display a single-line activity indicator while the agentic turn is in progress. The indicator MUST include a spinner glyph and an elapsed-time counter in seconds. The indicator SHALL NOT appear in non-TTY mode. The indicator MUST be cleared from the line before the rendered output is written, leaving no visible artifact.

#### Scenario: Indicator appears during long turn
- **WHEN** an agentic turn is in progress in TTY mode and exceeds a short grace period (~250ms)
- **THEN** a single-line spinner with elapsed seconds appears on stdout

#### Scenario: Indicator is cleared before output
- **WHEN** the agentic turn completes
- **THEN** the indicator line is cleared (cursor moved to column 0, line cleared) before the rendered model output is emitted, so no spinner glyph remains visible

#### Scenario: No indicator in non-TTY mode
- **WHEN** stdout is not a TTY
- **THEN** no spinner is displayed at any point during the agentic turn

#### Scenario: Indicator does not flash on fast turns
- **WHEN** the agentic turn completes within the grace period (~250ms)
- **THEN** the spinner is never shown

### Requirement: Indicator Pause Around Permission Prompts

When the permission gate prompts the user during an agentic turn, the indicator SHALL be paused before the prompt is rendered and resumed after the user responds. `ChatContext` MUST expose `pauseIndicator()` and `resumeIndicator()` methods that the permission gate calls. Both methods MUST be no-ops when no indicator is active (non-TTY mode, or outside an agentic turn).

#### Scenario: Spinner pauses during prompt
- **WHEN** a `write` or `exec` tool call triggers a permission prompt mid-turn
- **THEN** the spinner stops updating and the spinner line is cleared before the `Allow? [y/N]` prompt is rendered

#### Scenario: Spinner resumes after answer
- **WHEN** the user answers a permission prompt and the agentic turn continues
- **THEN** the spinner resumes from a fresh position on a new line, with the elapsed counter continuing from the original turn start

#### Scenario: pauseIndicator is a no-op in non-TTY mode
- **WHEN** the permission gate calls `ctx.pauseIndicator()` while running in non-TTY mode (no spinner ever started)
- **THEN** the call returns without effect and does not throw

### Requirement: Code Fence Syntax Highlighting

Fenced code blocks in the rendered output SHALL be syntax-highlighted using the language identifier from the fence info string. When no language is specified or the language is not recognized, the code MUST still render as a code block (without highlighting) — the absence of a language MUST NOT cause an error or unrendered output.

#### Scenario: Recognized language is highlighted
- **WHEN** the model emits a fenced code block tagged with a recognized language (e.g. ` ```ts `, ` ```python `)
- **THEN** the rendered code is syntax-highlighted in the terminal output

#### Scenario: Unknown or missing language renders without highlighting
- **WHEN** the model emits a fenced code block with no language tag or an unrecognized one
- **THEN** the rendered code appears as a code block without highlighting and without an error

### Requirement: Width-Adaptive Rendering

The renderer SHALL set its line width to the smaller of the current terminal width (`process.stdout.columns`) and a soft cap of 100 columns. When `process.stdout.columns` is unavailable, the renderer MUST fall back to 80 columns. Width is sampled once per render and is not re-applied if the terminal is resized mid-turn.

#### Scenario: Narrow terminal uses its full width
- **WHEN** the terminal width is 60 columns
- **THEN** the renderer wraps prose at 60 columns

#### Scenario: Wide terminal is capped at 100
- **WHEN** the terminal width is 200 columns
- **THEN** the renderer wraps prose at 100 columns

#### Scenario: Missing columns falls back to 80
- **WHEN** `process.stdout.columns` is undefined
- **THEN** the renderer wraps prose at 80 columns

### Requirement: Partial Output on Stream Error

When the SDK throws an error mid-stream, the CLI SHALL render whatever text was buffered up to the point of failure, then emit the error message as plain text. The indicator MUST be stopped and cleared in either the success or error path.

#### Scenario: Error after partial buffer
- **WHEN** the model has emitted some text and the underlying stream errors before completion
- **THEN** the buffered partial text is rendered as markdown AND the error message is then printed as plain text below it

#### Scenario: Indicator always cleaned up
- **WHEN** an agentic turn ends — whether by success, error, or denial
- **THEN** the indicator is stopped and the indicator line is cleared, leaving no spinner glyph on screen
