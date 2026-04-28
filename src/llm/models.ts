export const MODELS = {
  'openai/gpt-5.4-nano':          { tier: 'speed',    provider: 'openai' },
  'openai/gpt-5.4-mini':          { tier: 'reliable', provider: 'openai' },
  'anthropic/claude-haiku-4.5':   { tier: 'speed',    provider: 'anthropic' },
  'anthropic/claude-sonnet-4.6':  { tier: 'reliable', provider: 'anthropic' },
  'google/gemini-2.5-flash-lite': { tier: 'speed',    provider: 'google' },
  'google/gemini-2.5-flash':      { tier: 'reliable', provider: 'google' },
} as const

export type ModelId = keyof typeof MODELS
export const MODEL_IDS = Object.keys(MODELS) as ModelId[]
export const DEFAULT_MODEL: ModelId = 'anthropic/claude-haiku-4.5'

export function isKnownModel(id: string): id is ModelId {
  return Object.prototype.hasOwnProperty.call(MODELS, id)
}
