declare module 'marked-terminal' {
  import type { MarkedExtension } from 'marked'

  export interface MarkedTerminalOptions {
    width?: number
    reflowText?: boolean
    showSectionPrefix?: boolean
    unescape?: boolean
    emoji?: boolean
    tab?: number | string
    tableOptions?: Record<string, unknown>
    code?: (code: string, lang: string | undefined) => string
    blockquote?: (text: string) => string
    html?: (html: string) => string
    heading?: (text: string, level: number, raw: string) => string
    firstHeading?: (text: string, level: number, raw: string) => string
    hr?: () => string
    listitem?: (text: string) => string
    paragraph?: (text: string) => string
    strong?: (text: string) => string
    em?: (text: string) => string
    codespan?: (text: string) => string
    del?: (text: string) => string
    link?: (href: string, title: string | null, text: string) => string
    href?: (href: string, title: string | null, text: string) => string
    text?: (text: string) => string
  }

  export function markedTerminal(
    options?: MarkedTerminalOptions,
    highlightOptions?: Record<string, unknown>,
  ): MarkedExtension
}
