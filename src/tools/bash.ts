import { z } from 'zod'
import { spawn } from 'node:child_process'
import type { Tool } from './registry.js'

export const bashTool: Tool = {
  name: 'bash',
  description: 'Execute a shell command via /bin/sh -c and return { stdout, stderr, exit_code }. Use sparingly; prefer the file tools where possible.',
  risk: 'exec',
  parameters: z.object({
    command: z.string().describe('Shell command to execute.'),
  }),
  async execute({ command }) {
    return new Promise(resolveResult => {
      const child = spawn('/bin/sh', ['-c', command], {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: process.cwd(),
      })
      let stdout = ''
      let stderr = ''
      const MAX = 1024 * 1024 // 1 MiB cap per stream
      child.stdout.on('data', d => {
        if (stdout.length < MAX) stdout += d.toString()
      })
      child.stderr.on('data', d => {
        if (stderr.length < MAX) stderr += d.toString()
      })
      child.on('close', code => {
        resolveResult({
          stdout: trim(stdout, MAX),
          stderr: trim(stderr, MAX),
          exit_code: code ?? -1,
        })
      })
      child.on('error', err => {
        resolveResult({ error: 'spawn_failed', message: err.message })
      })
    })
  },
}

function trim(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '\n…[truncated]' : s
}
