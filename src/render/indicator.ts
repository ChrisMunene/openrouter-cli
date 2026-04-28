import { isTtyOutput } from './markdown.js'

const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const TICK_MS = 100
const GRACE_MS = 250

export class Indicator {
  private interval: NodeJS.Timeout | null = null
  private active = false                   // logically running (between start and stop)
  private resumeOriginAt = 0               // when current run-segment began
  private elapsedBeforeResume = 0          // accumulated active time across pauses
  private frame = 0
  private hasPrinted = false

  start(): void {
    if (!isTtyOutput()) return
    if (this.active) return
    this.active = true
    this.elapsedBeforeResume = 0
    this.resumeOriginAt = Date.now()
    this.hasPrinted = false
    this.interval = setInterval(() => this.tick(), TICK_MS)
  }

  pause(): void {
    if (!this.active) return
    if (this.interval !== null) {
      clearInterval(this.interval)
      this.interval = null
      this.elapsedBeforeResume += Date.now() - this.resumeOriginAt
    }
    this.clearLine()
  }

  resume(): void {
    if (!this.active) return
    if (this.interval !== null) return
    this.resumeOriginAt = Date.now()
    this.interval = setInterval(() => this.tick(), TICK_MS)
  }

  stop(): void {
    if (this.interval !== null) {
      clearInterval(this.interval)
      this.interval = null
    }
    this.clearLine()
    this.active = false
    this.hasPrinted = false
  }

  private tick(): void {
    if (!isTtyOutput()) return
    const elapsedMs = this.elapsedBeforeResume + (Date.now() - this.resumeOriginAt)
    if (elapsedMs < GRACE_MS) return
    this.frame = (this.frame + 1) % SPINNER.length
    const seconds = Math.floor(elapsedMs / 1000)
    process.stdout.cursorTo(0)
    process.stdout.clearLine(0)
    process.stdout.write(`${SPINNER[this.frame]} thinking… ${seconds}s`)
    this.hasPrinted = true
  }

  private clearLine(): void {
    if (!isTtyOutput()) return
    if (!this.hasPrinted) return
    process.stdout.cursorTo(0)
    process.stdout.clearLine(0)
    this.hasPrinted = false
  }
}
