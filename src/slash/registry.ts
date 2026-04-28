import type { ChatContext } from '../chat/loop.js'

export interface SlashCommand {
  name: string
  description: string
  run(ctx: ChatContext, args: string[]): Promise<void> | void
}

const registry = new Map<string, SlashCommand>()

export function registerSlashCommand(cmd: SlashCommand): void {
  registry.set(cmd.name, cmd)
}

export function getSlashCommand(name: string): SlashCommand | undefined {
  return registry.get(name)
}

export function allSlashCommands(): SlashCommand[] {
  return Array.from(registry.values())
}

export function parseSlashLine(line: string): { name: string; args: string[] } {
  const trimmed = line.trim().replace(/^\/+/, '')
  const parts = trimmed.split(/\s+/).filter(Boolean)
  return { name: parts[0] ?? '', args: parts.slice(1) }
}
