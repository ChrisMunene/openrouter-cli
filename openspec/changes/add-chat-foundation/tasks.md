## 1. Project Bootstrap

- [x] 1.1 Initialize `package.json` with `"type": "module"`, Node 20+ engine, and a `bin` entry mapping `or` to `dist/index.js`
- [x] 1.2 Add runtime dependencies: `ai`, `@openrouter/ai-sdk-provider`, `zod`, `mri` (or equivalent minimal arg parser)
- [x] 1.3 Add dev dependencies: `typescript`, `tsx`, `@types/node`
- [x] 1.4 Create `tsconfig.json` targeting ES2022, NodeNext modules, strict mode, `outDir: dist`
- [x] 1.5 Add npm scripts: `dev` (`tsx src/index.ts`), `build` (`tsc`), `start` (`node dist/index.js`)
- [x] 1.6 Create the directory skeleton: `src/{chat,llm,tools,slash,config}/`
- [x] 1.7 Add minimal `README.md` documenting `OPENROUTER_API_KEY`, `or`, `or "<prompt>"`, `or config`, and `--yolo`

## 2. Configuration

- [x] 2.1 Implement `src/config/load.ts` that reads `OPENROUTER_API_KEY` from env and exits with a one-line error if missing
- [x] 2.2 Read optional `~/.config/or/config.json`, honoring only `default_model` in v1
- [x] 2.3 Validate `default_model` against the hardcoded model list; exit non-zero with an error naming the offending value if invalid
- [x] 2.4 In the same loader, detect `AGENTS.md` then `OR.md` in CWD (first match wins) and return its contents as project memory; do NOT walk parent directories

## 3. Model Registry

- [x] 3.1 Create `src/llm/models.ts` exporting the six hardcoded model IDs as a `const` map with `tier` and `provider` fields
- [x] 3.2 Export a `DEFAULT_MODEL` constant set to `anthropic/claude-haiku-4.5`
- [x] 3.3 Export an `isKnownModel(id)` helper used by config validation and `/model`

## 4. LLM Client

- [x] 4.1 Implement `src/llm/client.ts` that constructs an `@openrouter/ai-sdk-provider` instance from `OPENROUTER_API_KEY`
- [x] 4.2 Expose a `getModel(id)` function returning the SDK model object for a given hardcoded ID

## 5. Tool Registry and Permission Gate

- [ ] 5.1 Define the `Tool` interface in `src/tools/registry.ts`: `name`, `description`, `parameters` (Zod schema), `risk: 'safe' | 'write' | 'exec'`, `execute(args, ctx)`
- [ ] 5.2 Implement the registry as a `Map<string, Tool>` with `register(tool)` and `all()` accessors
- [ ] 5.3 Add a helper that converts the registry into the `tools` shape expected by `streamText`
- [ ] 5.4 Implement `src/tools/permission.ts` exporting `checkPermission(tool, args, ctx)` that returns `'allow'` for `safe`, prompts on stdin for `write`/`exec`, and short-circuits to `'allow'` if `ctx.yolo` is true
- [ ] 5.5 Wire the permission gate so denial returns a structured `{ error: 'permission_denied' }` result to the model rather than throwing

## 6. Tool Implementations

- [ ] 6.1 `src/tools/read-file.ts` — risk `safe`; returns UTF-8 contents or a `{ error: 'not_found' }` result
- [ ] 6.2 `src/tools/list-dir.ts` — risk `safe`; returns entries with type info or `{ error: 'not_a_directory' }`
- [ ] 6.3 `src/tools/write-file.ts` — risk `write`; refuses to overwrite, returning `{ error: 'exists', hint: 'use edit_file' }` when the path exists
- [ ] 6.4 `src/tools/edit-file.ts` — risk `write`; rejects zero/multiple matches with `{ error: 'not_found' | 'ambiguous' }`; replaces a unique match
- [ ] 6.5 `src/tools/bash.ts` — risk `exec`; spawns the command via the system shell and returns `{ stdout, stderr, exit_code }`
- [ ] 6.6 Register all five tools in a single `registerDefaultTools()` call invoked at startup

## 7. Slash Command Registry

- [ ] 7.1 Define the `SlashCommand` interface in `src/slash/registry.ts`: `name`, `description`, `run(ctx, args)`
- [ ] 7.2 Implement the registry as a `Map<string, SlashCommand>` with `register` and `all`
- [ ] 7.3 Add a parser that splits a user input line beginning with `/` into name and argument tokens
- [ ] 7.4 On unknown command, print "unknown command" and suggest `/help`

## 8. Slash Command Implementations

- [ ] 8.1 `/help` — print every registered command's name + description
- [ ] 8.2 `/exit` — terminate the REPL and exit with code 0
- [ ] 8.3 `/clear` — reset the in-memory conversation history while preserving active model and session flags
- [ ] 8.4 `/model` — with no arg list the six IDs and mark the active one; with an arg, validate against the hardcoded list and switch or reject
- [ ] 8.5 `/tools` — print each registered tool's name, risk tier, and description
- [ ] 8.6 Register all five slash commands in a single `registerDefaultSlashCommands()` call invoked at startup

## 9. Chat Loop

- [ ] 9.1 Implement `src/chat/loop.ts` exporting `startChat(ctx)` and `runOneShot(prompt, ctx)`
- [ ] 9.2 Build the system prompt from the static base + project memory (if any)
- [ ] 9.3 Construct a `ChatContext` carrying `messages`, `activeModel`, `yolo`, and references to both registries
- [ ] 9.4 In the REPL: read a line, route to slash registry if it begins with `/`, otherwise append as a user message and run the agentic turn
- [ ] 9.5 Use `streamText({ model, messages, tools, stopWhen })` for the agentic turn; render text deltas as they stream; do NOT interleave tool-call narration with the streaming text
- [ ] 9.6 Tool execution flows through the permission gate; denial returns the structured error to the model so the loop can continue
- [ ] 9.7 Append the assistant message and any tool messages to `ctx.messages` after each iteration

## 10. Entrypoint

- [x] 10.1 Implement `src/index.ts` with a single `main()` function that parses argv, loads config, and dispatches
- [x] 10.2 Dispatch rules: `argv[0] === 'config'` → config subcommand; `argv[0]` present and not a known subcommand → one-shot with the joined arg as the prompt; no argv → REPL
- [x] 10.3 Parse `--yolo` and `--model <id>` flags; pass through to the chat context
- [x] 10.4 Print a one-line `--help` summary on `-h` / `--help`
- [ ] 10.5 Wire startup ordering: load config → register tools → register slash commands → start chat / one-shot / config

## 11. Config Subcommand (minimal)

- [ ] 11.1 Implement `or config get <key>` and `or config set <key> <value>` for the single allowed key `default_model`
- [ ] 11.2 Reject `set` for unknown keys and for values not in the hardcoded model list

## 12. Smoke Verification

- [ ] 12.1 Manual: `OPENROUTER_API_KEY=… npm run dev` enters the REPL with the default model
- [ ] 12.2 Manual: a turn that triggers `read_file` runs without prompting
- [ ] 12.3 Manual: a turn that triggers `write_file` prompts for approval, and denial returns control without crashing
- [ ] 12.4 Manual: `/model` lists the six IDs; `/model anthropic/claude-sonnet-4.6` switches; `/model bogus` is rejected
- [ ] 12.5 Manual: `/clear` empties history without ending the session; `/exit` ends with code 0
- [ ] 12.6 Manual: place an `AGENTS.md` in CWD and confirm its contents influence the model's first response
- [ ] 12.7 Manual: `or "what's in package.json"` runs one-shot and exits cleanly
