import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { CONFIG_PATH } from './load.js'
import { DEFAULT_MODEL, isKnownModel, MODEL_IDS } from '../llm/models.js'

const ALLOWED_KEYS = new Set(['default_model'])

export async function runConfigCommand(args: string[]): Promise<void> {
  const [verb, key, ...rest] = args

  if (!verb || verb === '-h' || verb === '--help' || verb === 'help') {
    printHelp()
    return
  }

  if (verb === 'get') {
    if (!key) fail('usage: or config get <key>')
    if (!ALLOWED_KEYS.has(key)) fail(`unknown key: ${key}`)
    console.log(readKey(key))
    return
  }

  if (verb === 'set') {
    const value = rest.join(' ')
    if (!key || !value) fail('usage: or config set <key> <value>')
    if (!ALLOWED_KEYS.has(key)) fail(`unknown key: ${key}`)
    if (key === 'default_model' && !isKnownModel(value)) {
      fail(`Invalid default_model: ${value}. Allowed:\n  ${MODEL_IDS.join('\n  ')}`)
    }
    writeKey(key, value)
    console.log(`set ${key} = ${value}`)
    return
  }

  fail(`unknown subcommand: ${verb}`)
}

function fail(msg: string): never {
  console.error(msg)
  process.exit(1)
}

function printHelp(): void {
  console.log(`Usage:
  or config get <key>
  or config set <key> <value>

Allowed keys:
  default_model    one of:
    ${MODEL_IDS.join('\n    ')}
`)
}

function readKey(key: string): string {
  const cfg = readConfig()
  const value = cfg[key]
  if (value === undefined) {
    return key === 'default_model' ? DEFAULT_MODEL : ''
  }
  return String(value)
}

function writeKey(key: string, value: string): void {
  const cfg = readConfig()
  cfg[key] = value
  mkdirSync(dirname(CONFIG_PATH), { recursive: true })
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + '\n', 'utf8')
}

function readConfig(): Record<string, unknown> {
  if (!existsSync(CONFIG_PATH)) return {}
  try {
    const parsed = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}
