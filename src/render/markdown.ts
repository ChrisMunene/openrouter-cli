import { Marked } from 'marked'
import { markedTerminal } from 'marked-terminal'
import { highlight } from 'cli-highlight'

const WIDTH_SOFT_CAP = 100
const WIDTH_FALLBACK = 80

export function isTtyOutput(): boolean {
  return process.stdout.isTTY === true
}

export function getRenderWidth(): number {
  return Math.min(process.stdout.columns ?? WIDTH_FALLBACK, WIDTH_SOFT_CAP)
}

function highlightCode(code: string, lang: string | undefined): string {
  if (!lang) {
    try {
      return highlight(code, { ignoreIllegals: true })
    } catch {
      return code
    }
  }
  try {
    return highlight(code, { language: lang, ignoreIllegals: true })
  } catch {
    return code
  }
}

export function renderMarkdown(text: string): string {
  const renderer = new Marked(
    markedTerminal({
      width: getRenderWidth(),
      reflowText: true,
      code: highlightCode,
    }),
  )
  const out = renderer.parse(text)
  return typeof out === 'string' ? out : String(out)
}
