import { z } from 'zod'
import { writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import type { Tool } from './registry.js'

export const writeFileTool: Tool = {
  name: 'write_file',
  description: 'Create a NEW file at path with the given content. Errors if the file already exists — use edit_file to modify existing files.',
  risk: 'write',
  parameters: z.object({
    path: z.string(),
    content: z.string(),
  }),
  async execute({ path, content }) {
    const abs = resolve(path)
    if (existsSync(abs)) {
      return { error: 'exists', path: abs, hint: 'Use edit_file to modify an existing file.' }
    }
    try {
      await mkdir(dirname(abs), { recursive: true })
      await writeFile(abs, content, 'utf8')
      return { ok: true, path: abs, bytes: Buffer.byteLength(content, 'utf8') }
    } catch (err) {
      return { error: 'write_failed', message: (err as Error).message, path: abs }
    }
  },
}
