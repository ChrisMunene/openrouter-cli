# cli-openrouter

A local CLI agent that chats and edits files on your computer, powered by OpenRouter.

## Setup

```bash
export OPENROUTER_API_KEY=sk-or-...   # get one at https://openrouter.ai/keys
npm install
npm run build && npm link              # makes the `or` binary available
```

Alternatively, drop the key into `.env.local` at the project root:

```
OPENROUTER_API_KEY=sk-or-...
```

The CLI auto-loads `.env.local` then `.env` from the current working directory at startup. An already-set environment variable always wins. Both files are gitignored.

For dev iteration without building:

```bash
npm run dev -- [args...]
```

## Usage

```
or                       Start the interactive REPL
or "<prompt>"            One-shot: send the prompt, print the response, exit
or config get <key>      Read a config value
or config set <k> <v>    Write a config value (allowed key: default_model)
or --help                Show help
```

### Flags

- `--model <id>` — override the active model for this session
- `--yolo` — auto-approve all tool calls (skips permission prompts for write/exec tools)

### Models

Six hardcoded options (selectable in-session via `/model`):

| Provider  | Speed                            | Reliable                       |
|-----------|----------------------------------|--------------------------------|
| OpenAI    | `openai/gpt-5.4-nano`            | `openai/gpt-5.4-mini`          |
| Anthropic | `anthropic/claude-haiku-4.5`     | `anthropic/claude-sonnet-4.6`  |
| Google    | `google/gemini-2.5-flash-lite`   | `google/gemini-2.5-flash`      |

Default: `anthropic/claude-haiku-4.5`.

### Project memory

If `AGENTS.md` (or `OR.md`) exists in the current working directory, its contents are prepended to the system prompt for the session.

### Configuration

Optional config file at `~/.config/or/config.json`:

```json
{ "default_model": "anthropic/claude-haiku-4.5" }
```

The API key is only read from the `OPENROUTER_API_KEY` environment variable; it is never written to disk by the CLI.
