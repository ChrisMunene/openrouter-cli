import { createInterface, type Interface as ReadlineInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { streamText, stepCountIs, type ModelMessage } from 'ai'
import type { LoadedConfig } from '../config/load.js'
import type { ModelId } from '../llm/models.js'
import { getModel } from '../llm/client.js'
import { toAiSdkToolSet } from '../tools/registry.js'
import { getSlashCommand, parseSlashLine } from '../slash/registry.js'
import { renderMarkdown, isTtyOutput } from '../render/markdown.js'
import { Indicator } from '../render/indicator.js'

export interface ChatContext {
  config: LoadedConfig
  activeModel: ModelId
  yolo: boolean
  messages: ModelMessage[]
  rl: ReadlineInterface
  pauseIndicator: () => void
  resumeIndicator: () => void
}

export type SessionInit = Omit<ChatContext, 'messages' | 'rl' | 'pauseIndicator' | 'resumeIndicator'>

const SYSTEM_BASE = (cwd: string) =>
  `You are a local CLI agent running on the user's computer. You have tools to read files, list directories, write new files, edit existing files via string match, and run shell commands. Use the tools to investigate before answering. Prefer surgical edits over rewrites. The user is working in: ${cwd}.`

function buildSystemPrompt(ctx: ChatContext): string {
  const base = SYSTEM_BASE(process.cwd())
  if (!ctx.config.projectMemory) return base
  return `${base}\n\n# Project Memory\n${ctx.config.projectMemory}`
}

const noop = (): void => {}

export async function startChat(init: SessionInit): Promise<void> {
  const rl = createInterface({ input: stdin, output: stdout })
  const ctx: ChatContext = {
    ...init,
    messages: [],
    rl,
    pauseIndicator: noop,
    resumeIndicator: noop,
  }

  console.log(
    `or — chatting with ${ctx.activeModel}${ctx.yolo ? ' (yolo)' : ''}. /help for commands, /exit or Ctrl+D to quit.`,
  )

  try {
    while (true) {
      let line: string
      try {
        line = await rl.question('> ')
      } catch {
        break
      }
      if (!line.trim()) continue

      if (line.startsWith('/')) {
        await runSlash(line, ctx)
        continue
      }

      ctx.messages.push({ role: 'user', content: line })
      await runAgenticTurn(ctx)
    }
  } finally {
    rl.close()
  }
}

export async function runOneShot(prompt: string, init: SessionInit): Promise<void> {
  const rl = createInterface({ input: stdin, output: stdout })
  const ctx: ChatContext = {
    ...init,
    messages: [{ role: 'user', content: prompt }],
    rl,
    pauseIndicator: noop,
    resumeIndicator: noop,
  }
  try {
    await runAgenticTurn(ctx)
  } finally {
    rl.close()
  }
}

async function runSlash(line: string, ctx: ChatContext): Promise<void> {
  const { name, args } = parseSlashLine(line)
  if (!name) return
  const cmd = getSlashCommand(name)
  if (!cmd) {
    console.log(`Unknown command: /${name}. Try /help.`)
    return
  }
  await cmd.run(ctx, args)
}

async function runAgenticTurn(ctx: ChatContext): Promise<void> {
  const indicator = new Indicator()
  ctx.pauseIndicator = () => indicator.pause()
  ctx.resumeIndicator = () => indicator.resume()
  let buffered = ''

  try {
    indicator.start()

    const result = streamText({
      model: getModel(ctx.activeModel),
      system: buildSystemPrompt(ctx),
      messages: ctx.messages,
      tools: toAiSdkToolSet(ctx),
      stopWhen: stepCountIs(20),
    })

    for await (const chunk of result.textStream) {
      buffered += chunk
    }

    indicator.stop()
    emit(buffered)

    const final = await result.response
    ctx.messages.push(...final.messages)
  } catch (err) {
    indicator.stop()
    if (buffered) emit(buffered)
    console.error(`error: ${(err as Error).message}`)
  } finally {
    indicator.stop()
    ctx.pauseIndicator = noop
    ctx.resumeIndicator = noop
  }
}

function emit(text: string): void {
  if (!text) return
  const out = isTtyOutput() ? renderMarkdown(text) : text
  stdout.write(out)
  if (!out.endsWith('\n')) stdout.write('\n')
}
