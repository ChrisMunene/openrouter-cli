import { z } from 'zod'
import { readdir, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Tool } from './registry.js'

export const listDirTool: Tool = {
  name: 'list_dir',
  description: 'List immediate entries of a directory with type info. Returns { entries: [{name, type}] } or { error }.',
  risk: 'safe',
  parameters: z.object({
    path: z.string().describe('Path to the directory.'),
  }),
  async execute({ path }) {
    const abs = resolve(path)
    let s
    try {
      s = await stat(abs)
    } catch (err) {
      const e = err as NodeJS.ErrnoException
      if (e.code === 'ENOENT') return { error: 'not_found', path: abs }
      return { error: 'stat_failed', message: e.message, path: abs }
    }
    if (!s.isDirectory()) return { error: 'not_a_directory', path: abs }
    try {
      const entries = await readdir(abs, { withFileTypes: true })
      return {
        path: abs,
        entries: entries.map(e => ({
          name: e.name,
          type: e.isDirectory() ? 'directory' : e.isFile() ? 'file' : 'other',
        })),
      }
    } catch (err) {
      return { error: 'list_failed', message: (err as Error).message, path: abs }
    }
  },
}
