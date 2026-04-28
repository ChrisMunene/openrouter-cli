import { z } from 'zod'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Tool } from './registry.js'

export const readFileTool: Tool = {
  name: 'read_file',
  description: 'Read the UTF-8 contents of a file. Returns { content } on success or { error } on failure.',
  risk: 'safe',
  parameters: z.object({
    path: z.string().describe('Path to the file (absolute or relative to the working directory).'),
  }),
  async execute({ path }) {
    const abs = resolve(path)
    try {
      const content = await readFile(abs, 'utf8')
      return { content, path: abs }
    } catch (err) {
      const e = err as NodeJS.ErrnoException
      if (e.code === 'ENOENT') return { error: 'not_found', path: abs }
      if (e.code === 'EISDIR') return { error: 'is_directory', path: abs }
      return { error: 'read_failed', message: e.message, path: abs }
    }
  },
}
