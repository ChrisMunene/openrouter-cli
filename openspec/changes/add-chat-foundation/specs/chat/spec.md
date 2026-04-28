## ADDED Requirements

### Requirement: CLI Entrypoint Dispatch

The CLI SHALL expose a single binary `or` whose entrypoint dispatches `argv` into exactly one of three modes: interactive REPL, one-shot prompt, or `config` subcommand. The entrypoint MUST contain dispatch logic only — no chat, model, or tool logic.

#### Scenario: Bare invocation enters the REPL
- **WHEN** the user runs `or` with no arguments
- **THEN** the CLI starts the interactive chat REPL and prompts the user for input

#### Scenario: Quoted prompt runs one-shot
- **WHEN** the user runs `or "summarize the README"`
- **THEN** the CLI sends the prompt as a single user message, runs the agentic turn to completion, prints the final response, and exits with code 0

#### Scenario: First-token subcommand routes to its handler
- **WHEN** the user runs `or config <subcommand>`
- **THEN** the CLI invokes the `config` subcommand handler and does NOT start the REPL or one-shot path

#### Scenario: Missing API key fails fast
- **WHEN** the user runs `or` with `OPENROUTER_API_KEY` unset
- **THEN** the CLI exits with a non-zero code and prints a single-line error explaining how to set the key

### Requirement: Interactive Chat REPL with Agentic Turn

The REPL SHALL accept one line of user input per turn, append it to an in-memory message history, and execute an agentic turn against the active model. An agentic turn MUST iterate model invocations and tool executions until the model returns a final text response with no further tool calls.

#### Scenario: Plain text turn
- **WHEN** the user enters a line that does not start with `/`
- **THEN** the line is appended to history as a user message and the agentic turn runs to completion before the prompt is shown again

#### Scenario: Tool calls are executed within the same turn
- **WHEN** the model emits one or more tool calls in response to a user message
- **THEN** the CLI executes each tool (subject to the permission gate), feeds the results back to the model, and continues until the model returns text without tool calls

#### Scenario: History persists across turns within a session
- **WHEN** the user sends multiple messages in one REPL session
- **THEN** the prior turns remain in the in-memory message history and are passed to the model on each subsequent turn

#### Scenario: History does not persist across sessions
- **WHEN** the user exits the REPL and starts a new session
- **THEN** the new session begins with an empty in-memory history (no on-disk persistence)

### Requirement: Slash Command Registry

The CLI SHALL maintain a registry of slash commands keyed by name. Any user input beginning with `/` SHALL be routed to the registry instead of the model. The registry MUST be the only mechanism through which slash commands are dispatched.

#### Scenario: Registered slash command is dispatched
- **WHEN** the user enters a line beginning with `/<name>` where `<name>` is registered
- **THEN** the registered command's handler is invoked with the remaining arguments and the model is NOT called

#### Scenario: Unknown slash command shows guidance
- **WHEN** the user enters a line beginning with `/<name>` where `<name>` is not registered
- **THEN** the CLI prints an "unknown command" message and suggests `/help`

### Requirement: Model-Tool Registry

The CLI SHALL maintain a registry of model-callable tools keyed by name. Each tool MUST declare a `name`, `description`, an argument schema, and a `risk` tier (`safe`, `write`, or `exec`). The set of registered tools SHALL be the exact set passed to the model on every turn.

#### Scenario: Registered tools are exposed to the model
- **WHEN** the CLI sends a request to the model
- **THEN** the request includes the schemas for every tool in the registry

#### Scenario: Tool not in registry is unreachable
- **WHEN** the model attempts to call a tool whose name is not in the registry
- **THEN** the CLI returns a structured error to the model and the call is not executed

### Requirement: Risk-Tiered Permission Gate

The permission gate SHALL consult each tool's `risk` tier before invocation. Tools at tier `safe` MUST run without prompting. Tools at tier `write` or `exec` MUST prompt the user for per-call approval unless the session was started with the `--yolo` flag. A denial MUST return a structured "permission denied" result to the model rather than terminating the turn.

#### Scenario: Safe tool runs silently
- **WHEN** the model calls a tool with `risk: 'safe'`
- **THEN** the tool runs without any user prompt and the result is returned to the model

#### Scenario: Write tool prompts by default
- **WHEN** the model calls a tool with `risk: 'write'` and `--yolo` was not supplied
- **THEN** the CLI prompts the user with the target path and waits for approval before running the tool

#### Scenario: Exec tool prompts by default
- **WHEN** the model calls a tool with `risk: 'exec'` and `--yolo` was not supplied
- **THEN** the CLI prompts the user with the command and waits for approval before running the tool

#### Scenario: --yolo bypasses prompts
- **WHEN** the session was started with `--yolo`
- **THEN** tools at tiers `write` and `exec` run without prompting, identically to `safe` tools

#### Scenario: Denial returns structured error
- **WHEN** the user denies a permission prompt
- **THEN** the tool is not executed and a structured "permission denied by user" result is fed back to the model so the agentic turn can continue or recover

### Requirement: Hardcoded Model Selection

The CLI SHALL select from a fixed set of six model identifiers stored as a constant in the codebase: two tiers (speed, reliable) for each of OpenAI, Anthropic, and Google. The default boot model SHALL be `anthropic/claude-haiku-4.5`. Selection of any model outside this list MUST be rejected.

#### Scenario: Default model is used at boot
- **WHEN** the user starts a session with no model override
- **THEN** the active model is `anthropic/claude-haiku-4.5`

#### Scenario: Active model is the only one called
- **WHEN** the agentic turn invokes the model
- **THEN** the request targets exactly the active model identifier

#### Scenario: Unknown model is rejected
- **WHEN** the user attempts to select a model identifier not in the hardcoded list
- **THEN** the CLI rejects the selection with a message listing the six allowed identifiers

### Requirement: Configuration Loading

The CLI SHALL read `OPENROUTER_API_KEY` from the environment as the only required configuration value. The CLI SHALL additionally read an optional configuration file at `~/.config/or/config.json` whose only v1 honored field is `default_model`. The API key MUST NOT be written to disk by the CLI.

#### Scenario: API key absent
- **WHEN** the CLI starts and `OPENROUTER_API_KEY` is unset
- **THEN** the CLI exits with a non-zero code and an error message

#### Scenario: Config file overrides default boot model
- **WHEN** `~/.config/or/config.json` exists and contains a `default_model` field whose value is in the hardcoded model list
- **THEN** that model is used as the default boot model instead of `anthropic/claude-haiku-4.5`

#### Scenario: Config file with unknown model is rejected
- **WHEN** `~/.config/or/config.json` specifies a `default_model` not in the hardcoded list
- **THEN** the CLI exits with a non-zero code and an error naming the offending value

#### Scenario: Missing config file is not an error
- **WHEN** `~/.config/or/config.json` does not exist
- **THEN** the CLI proceeds using the built-in default model

### Requirement: Project Memory Loading

On startup, the CLI SHALL check the current working directory for a project memory file. If `AGENTS.md` exists, its contents SHALL be prepended to the system prompt. If `AGENTS.md` does not exist but `OR.md` does, `OR.md` SHALL be used. The CLI MUST NOT walk parent directories or merge multiple files.

#### Scenario: AGENTS.md is loaded when present
- **WHEN** the CLI starts in a directory containing `AGENTS.md`
- **THEN** the contents of `AGENTS.md` are prepended to the system prompt for the session

#### Scenario: OR.md is the fallback
- **WHEN** the CLI starts in a directory containing `OR.md` but not `AGENTS.md`
- **THEN** the contents of `OR.md` are prepended to the system prompt for the session

#### Scenario: AGENTS.md takes precedence
- **WHEN** the CLI starts in a directory containing both `AGENTS.md` and `OR.md`
- **THEN** only `AGENTS.md` is loaded; `OR.md` is ignored

#### Scenario: Neither file present
- **WHEN** the CLI starts in a directory containing neither file
- **THEN** the session uses only the built-in system prompt with no project memory

### Requirement: Tool — read_file

The `read_file` tool SHALL accept a single `path` argument and return the file's UTF-8 contents. Its risk tier MUST be `safe`. The tool MUST return a structured error rather than throwing when the path does not exist or is not readable.

#### Scenario: Existing file is read
- **WHEN** the model calls `read_file` with a path that exists and is readable
- **THEN** the tool returns the file's contents to the model

#### Scenario: Missing file returns structured error
- **WHEN** the model calls `read_file` with a non-existent path
- **THEN** the tool returns a structured error indicating "file not found" without prompting the user

### Requirement: Tool — list_dir

The `list_dir` tool SHALL accept a single `path` argument and return the directory's entries with their types (file/directory). Its risk tier MUST be `safe`.

#### Scenario: Existing directory is listed
- **WHEN** the model calls `list_dir` with a path to a directory
- **THEN** the tool returns the immediate entries of that directory with type information

#### Scenario: Path is a file, not a directory
- **WHEN** the model calls `list_dir` with a path that points to a file
- **THEN** the tool returns a structured error indicating the path is not a directory

### Requirement: Tool — write_file

The `write_file` tool SHALL accept `path` and `content` arguments and create a new file at `path` with the given content. Its risk tier MUST be `write`. The tool MUST refuse to overwrite an existing file and MUST return a structured error in that case directing the model to use `edit_file` instead.

#### Scenario: New file is created
- **WHEN** the model calls `write_file` with a path that does not exist (and the user approves the prompt or `--yolo` is set)
- **THEN** the file is created with the provided content and the tool returns success

#### Scenario: Existing path is rejected
- **WHEN** the model calls `write_file` with a path that already exists
- **THEN** the tool returns a structured error directing the model to use `edit_file` and the existing file is unchanged

#### Scenario: Permission denial leaves filesystem unchanged
- **WHEN** the user denies the write prompt
- **THEN** no file is created and a structured "permission denied" result is returned to the model

### Requirement: Tool — edit_file

The `edit_file` tool SHALL accept `path`, `old_string`, and `new_string` arguments and replace `old_string` with `new_string` in the file at `path`. Its risk tier MUST be `write`. The tool MUST require `old_string` to match exactly once in the file; zero matches and multiple matches MUST both return a structured error without modifying the file.

#### Scenario: Unique match is replaced
- **WHEN** the model calls `edit_file` and `old_string` appears exactly once in the file (and the user approves or `--yolo` is set)
- **THEN** that single occurrence is replaced with `new_string` and the tool returns success

#### Scenario: No match is rejected
- **WHEN** `old_string` does not appear in the file
- **THEN** the tool returns a structured "not found" error and the file is unchanged

#### Scenario: Multiple matches are rejected
- **WHEN** `old_string` appears more than once in the file
- **THEN** the tool returns a structured "ambiguous match" error and the file is unchanged

#### Scenario: Permission denial leaves file unchanged
- **WHEN** the user denies the write prompt
- **THEN** the file is not modified and a structured "permission denied" result is returned to the model

### Requirement: Tool — bash

The `bash` tool SHALL accept a `command` argument and execute it via the system shell, returning stdout, stderr, and the exit code. Its risk tier MUST be `exec`. The tool MUST NOT sandbox the command in v1; the permission gate is the only barrier.

#### Scenario: Command runs and result is returned
- **WHEN** the model calls `bash` with a valid command (and the user approves or `--yolo` is set)
- **THEN** the tool returns stdout, stderr, and exit code to the model

#### Scenario: Permission denial blocks execution
- **WHEN** the user denies the exec prompt
- **THEN** the command is not executed and a structured "permission denied" result is returned to the model

### Requirement: Slash Command — /help

The `/help` command SHALL list every registered slash command with its name and one-line description.

#### Scenario: Help lists every registered command
- **WHEN** the user enters `/help`
- **THEN** the CLI prints each registered slash command's name and description, including `/help` itself

### Requirement: Slash Command — /exit

The `/exit` command SHALL terminate the REPL and exit the process with code 0.

#### Scenario: Exit terminates the session
- **WHEN** the user enters `/exit`
- **THEN** the REPL terminates and the process exits with code 0

### Requirement: Slash Command — /clear

The `/clear` command SHALL reset the in-memory conversation history while preserving the active model and any session flags (e.g., `--yolo`).

#### Scenario: Clear resets history but not session
- **WHEN** the user enters `/clear` after sending several messages
- **THEN** the next turn starts with empty conversation history but the same active model and session flags as before

### Requirement: Slash Command — /model

The `/model` command SHALL switch the active model for subsequent turns. With no argument, it SHALL list the six hardcoded model identifiers and indicate which is active. With an argument, it SHALL set the active model only if the argument is in the hardcoded list.

#### Scenario: No argument lists models
- **WHEN** the user enters `/model` with no argument
- **THEN** the CLI prints the six hardcoded identifiers and marks the currently active one

#### Scenario: Valid argument switches model
- **WHEN** the user enters `/model <id>` where `<id>` is in the hardcoded list
- **THEN** subsequent turns target `<id>` and the CLI confirms the switch

#### Scenario: Invalid argument is rejected
- **WHEN** the user enters `/model <id>` where `<id>` is NOT in the hardcoded list
- **THEN** the active model is unchanged and the CLI prints an error listing the six allowed identifiers

### Requirement: Slash Command — /tools

The `/tools` command SHALL list every registered model-callable tool with its name, risk tier, and description.

#### Scenario: Tools lists every registered tool
- **WHEN** the user enters `/tools`
- **THEN** the CLI prints each registered tool's name, risk tier, and description
