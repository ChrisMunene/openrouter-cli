import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import type { LoadedConfig } from '../config/load.js'
import type { ModelId } from '../llm/models.js'

export interface ChatContext {
  config: LoadedConfig
  activeModel: ModelId
  yolo: boolean
}

export async function startChat(ctx: ChatContext): Promise<void> {
  const banner = `or — chatting with ${ctx.activeModel}${ctx.yolo ? ' (yolo)' : ''}. Type /exit or Ctrl+D to quit.`
  console.log(banner)

  const rl = createInterface({ input: stdin, output: stdout })

  while (true) {
    let line: string
    try {
      line = await rl.question('> ')
    } catch {
      break
    }

    if (line === '/exit') break
    if (!line.trim()) continue

    // Phase 1 placeholder. Slash routing arrives in Phase 2; agentic turn in Phase 4.
    console.log(`(echo) ${line}`)
  }

  rl.close()
}

export async function runOneShot(prompt: string, ctx: ChatContext): Promise<void> {
  // Phase 1 placeholder. Real one-shot turn lands in Phase 4.
  console.log(`(would send to ${ctx.activeModel}): ${prompt}`)
}
