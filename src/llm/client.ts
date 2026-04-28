import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import type { ModelId } from './models.js'

let provider: ReturnType<typeof createOpenRouter> | null = null

export function initLLM(apiKey: string): void {
  provider = createOpenRouter({ apiKey })
}

export function getModel(id: ModelId) {
  if (!provider) throw new Error('LLM provider not initialized — call initLLM(apiKey) first')
  return provider(id)
}
