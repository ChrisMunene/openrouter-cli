import { allSlashCommands, registerSlashCommand, type SlashCommand } from './registry.js'
import { allTools } from '../tools/registry.js'
import { isKnownModel, MODEL_IDS } from '../llm/models.js'

const help: SlashCommand = {
  name: 'help',
  description: 'List available slash commands',
  run() {
    const cmds = allSlashCommands().slice().sort((a, b) => a.name.localeCompare(b.name))
    console.log('Slash commands:')
    for (const c of cmds) {
      console.log(`  /${c.name.padEnd(8)}  ${c.description}`)
    }
  },
}

const exit: SlashCommand = {
  name: 'exit',
  description: 'Quit the REPL',
  run() {
    process.exit(0)
  },
}

const clear: SlashCommand = {
  name: 'clear',
  description: 'Reset conversation history (keeps active model and session flags)',
  run(ctx) {
    ctx.messages.length = 0
    console.log('History cleared.')
  },
}

const model: SlashCommand = {
  name: 'model',
  description: 'Switch active model (no arg lists options)',
  run(ctx, args) {
    if (args.length === 0) {
      console.log('Models:')
      for (const id of MODEL_IDS) {
        console.log(`  ${id === ctx.activeModel ? '*' : ' '} ${id}`)
      }
      return
    }
    const id = args[0]
    if (!isKnownModel(id)) {
      console.error(`Unknown model: ${id}. Allowed:\n  ${MODEL_IDS.join('\n  ')}`)
      return
    }
    ctx.activeModel = id
    console.log(`Switched to ${id}.`)
  },
}

const tools: SlashCommand = {
  name: 'tools',
  description: 'List model-callable tools',
  run() {
    const ts = allTools()
    if (ts.length === 0) {
      console.log('(no tools registered)')
      return
    }
    console.log('Tools:')
    for (const t of ts) {
      console.log(`  ${t.name.padEnd(12)} [${t.risk.padEnd(5)}]  ${t.description}`)
    }
  },
}

export function registerDefaultSlashCommands(): void {
  registerSlashCommand(help)
  registerSlashCommand(exit)
  registerSlashCommand(clear)
  registerSlashCommand(model)
  registerSlashCommand(tools)
}
