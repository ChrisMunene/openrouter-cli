import { tool, type ToolSet } from 'ai'
import type { z } from 'zod'
import type { ChatContext } from '../chat/loop.js'
import { checkPermission } from './permission.js'

export type Risk = 'safe' | 'write' | 'exec'

export interface Tool<P extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string
  description: string
  parameters: P
  risk: Risk
  execute(args: z.infer<P>, ctx: ChatContext): Promise<unknown> | unknown
}

const registry = new Map<string, Tool>()

export function registerTool<P extends z.ZodTypeAny>(t: Tool<P>): void {
  registry.set(t.name, t as unknown as Tool)
}

export function allTools(): Tool[] {
  return Array.from(registry.values())
}

export function toAiSdkToolSet(ctx: ChatContext): ToolSet {
  const set: ToolSet = {}
  for (const t of registry.values()) {
    set[t.name] = tool({
      description: t.description,
      inputSchema: t.parameters,
      execute: async (args: unknown) => {
        const perm = await checkPermission(t, args, ctx)
        if (!perm.allow) {
          return { error: 'permission_denied', reason: perm.reason }
        }
        try {
          return await t.execute(args as never, ctx)
        } catch (err) {
          return { error: 'tool_error', message: (err as Error).message }
        }
      },
    })
  }
  return set
}
