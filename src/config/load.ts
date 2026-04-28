import { readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_MODEL, isKnownModel, type ModelId } from '../llm/models.js'

export interface LoadedConfig {
  apiKey: string
  defaultModel: ModelId
  projectMemory: string | null
}

export const CONFIG_PATH = join(homedir(), '.config', 'or', 'config.json')

export function loadConfig(): LoadedConfig {
  loadDotenv(join(process.cwd(), '.env.local'))
  loadDotenv(join(process.cwd(), '.env'))

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    console.error(
      'OPENROUTER_API_KEY is not set. Set it in .env.local at the project root, or `export OPENROUTER_API_KEY=sk-or-...`. Get a key at https://openrouter.ai/keys.',
    )
    process.exit(1)
  }

  const defaultModel = readDefaultModelFromConfig()
  const projectMemory = readProjectMemory()

  return { apiKey, defaultModel, projectMemory }
}

function readDefaultModelFromConfig(): ModelId {
  if (!existsSync(CONFIG_PATH)) return DEFAULT_MODEL

  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
  } catch (err) {
    console.error(`Failed to parse ${CONFIG_PATH}: ${(err as Error).message}`)
    process.exit(1)
  }

  if (!parsed || typeof parsed !== 'object') return DEFAULT_MODEL
  const value = (parsed as Record<string, unknown>).default_model
  if (value === undefined) return DEFAULT_MODEL

  if (typeof value !== 'string' || !isKnownModel(value)) {
    console.error(`Invalid default_model in ${CONFIG_PATH}: ${String(value)}`)
    process.exit(1)
  }
  return value
}

function readProjectMemory(): string | null {
  for (const name of ['AGENTS.md', 'OR.md']) {
    const path = join(process.cwd(), name)
    if (existsSync(path)) {
      try {
        return readFileSync(path, 'utf8')
      } catch {
        return null
      }
    }
  }
  return null
}

function loadDotenv(path: string): void {
  if (!existsSync(path)) return
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    return
  }
  for (const rawLine of raw.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    if (!key) continue
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}
