import { z } from 'zod'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Tool } from './registry.js'

export const editFileTool: Tool = {
  name: 'edit_file',
  description: 'Replace exactly one occurrence of old_string with new_string in the file at path. Errors if old_string is missing or appears multiple times — provide more surrounding context to disambiguate.',
  risk: 'write',
  parameters: z.object({
    path: z.string(),
    old_string: z.string().describe('Exact substring to find. Must match exactly once.'),
    new_string: z.string().describe('Replacement text.'),
  }),
  async execute({ path, old_string, new_string }) {
    const abs = resolve(path)
    let content: string
    try {
      content = await readFile(abs, 'utf8')
    } catch (err) {
      const e = err as NodeJS.ErrnoException
      if (e.code === 'ENOENT') return { error: 'not_found', path: abs }
      return { error: 'read_failed', message: e.message, path: abs }
    }

    const first = content.indexOf(old_string)
    if (first === -1) return { error: 'no_match', path: abs }
    const second = content.indexOf(old_string, first + old_string.length)
    if (second !== -1) {
      return {
        error: 'ambiguous',
        path: abs,
        hint: 'old_string matches more than once. Include more surrounding context to make the match unique.',
      }
    }

    const updated = content.slice(0, first) + new_string + content.slice(first + old_string.length)
    try {
      await writeFile(abs, updated, 'utf8')
      return { ok: true, path: abs }
    } catch (err) {
      return { error: 'write_failed', message: (err as Error).message, path: abs }
    }
  },
}
