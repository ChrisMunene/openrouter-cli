#!/usr/bin/env node
import mri from 'mri'
import { loadConfig } from './config/load.js'
import { runConfigCommand } from './config/command.js'
import { initLLM } from './llm/client.js'
import { isKnownModel, MODEL_IDS, type ModelId } from './llm/models.js'
import { startChat, runOneShot, type SessionInit } from './chat/loop.js'
import { registerDefaultTools } from './tools/index.js'
import { registerDefaultSlashCommands } from './slash/commands.js'

const HELP = `or — local CLI agent powered by OpenRouter

Usage:
  or                          Start the interactive REPL
  or "<prompt>"               One-shot: send the prompt, print response, exit
  or config get <key>         Read a config value
  or config set <key> <val>   Write a config value (allowed: default_model)
  or -h, --help               Show this help

Flags:
  --model <id>                Override the active model for this session
  --yolo                      Auto-approve all tool calls

Required env (or set in .env.local):
  OPENROUTER_API_KEY          OpenRouter API key

Hardcoded models:
  ${MODEL_IDS.join('\n  ')}
`

const KNOWN_SUBCOMMANDS = new Set(['config'])

async function main(): Promise<void> {
  const args = mri(process.argv.slice(2), {
    boolean: ['yolo', 'help'],
    string: ['model'],
    alias: { h: 'help' },
  })

  if (args.help) {
    process.stdout.write(HELP)
    return
  }

  const positional = (args._ as string[]) ?? []

  if (positional[0] && KNOWN_SUBCOMMANDS.has(positional[0])) {
    if (positional[0] === 'config') {
      await runConfigCommand(positional.slice(1))
    }
    return
  }

  const config = loadConfig()
  initLLM(config.apiKey)
  registerDefaultTools()
  registerDefaultSlashCommands()

  const activeModel = resolveActiveModel(args.model, config.defaultModel)
  const init: SessionInit = { config, activeModel, yolo: !!args.yolo }

  if (positional.length === 0) {
    await startChat(init)
  } else {
    await runOneShot(positional.join(' '), init)
  }
}

function resolveActiveModel(flag: string | undefined, fallback: ModelId): ModelId {
  if (!flag) return fallback
  if (!isKnownModel(flag)) {
    console.error(`Unknown model: ${flag}. Known models:\n  ${MODEL_IDS.join('\n  ')}`)
    process.exit(1)
  }
  return flag
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
