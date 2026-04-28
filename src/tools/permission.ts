import type { Tool } from './registry.js'
import type { ChatContext } from '../chat/loop.js'

export type Permission = { allow: true } | { allow: false; reason: string }

let promptChain: Promise<unknown> = Promise.resolve()

async function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const prev = promptChain
  const next = (async () => {
    try { await prev } catch { /* ignore prior errors for queueing */ }
    return fn()
  })()
  promptChain = next.catch(() => {})
  return next
}

export async function checkPermission(
  t: Tool,
  args: unknown,
  ctx: ChatContext,
): Promise<Permission> {
  if (t.risk === 'safe') return { allow: true }
  if (ctx.yolo) return { allow: true }

  return serialize(async () => {
    const summary = formatSummary(t, args)
    const prompt = `\n→ ${t.name} [${t.risk}] ${summary}\n  Allow? [y/N] `
    ctx.pauseIndicator()
    let answer: string
    try {
      answer = await ctx.rl.question(prompt)
    } catch {
      return { allow: false, reason: 'input closed' }
    } finally {
      ctx.resumeIndicator()
    }
    return answer.trim().toLowerCase().startsWith('y')
      ? { allow: true }
      : { allow: false, reason: 'denied by user' }
  })
}

function formatSummary(t: Tool, args: unknown): string {
  const a = (args ?? {}) as Record<string, unknown>
  switch (t.name) {
    case 'write_file': return `path: ${String(a.path)}`
    case 'edit_file':  return `path: ${String(a.path)}`
    case 'bash':       return `command: ${String(a.command)}`
    default:           return JSON.stringify(args)
  }
}
