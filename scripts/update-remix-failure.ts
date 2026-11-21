// ---------------------------------------------------------------------------
// Failure reporting for the pin-update script.
//
// A failed step carries its command, exit status, the last lines of its output,
// and an optional hint, so `main().catch()` can print an actionable resume
// summary instead of a bare "exited 1". Streaming commands feed a small tail
// buffer; commands that keep inherited stdio still carry the step name.
// ---------------------------------------------------------------------------

const TAIL_LINES = 20

export type TailBuffer = {
  push(chunk: string): void
  text(): string
}

export function createTail(maxLines = TAIL_LINES): TailBuffer {
  let lines: string[] = []
  let pending = ''

  return {
    push(chunk: string) {
      pending += chunk
      let parts = pending.split('\n')
      pending = parts.pop() ?? ''
      lines.push(...parts)
      if (lines.length > maxLines) lines = lines.slice(-maxLines)
    },
    text() {
      let all = pending ? [...lines, pending] : lines
      return all.slice(-maxLines).join('\n')
    },
  }
}

export class StepFailure extends Error {
  readonly step: string
  readonly status: number | null
  readonly tail: string
  readonly hint: string | undefined

  constructor(step: string, status: number | null, tail = '', hint?: string) {
    super(status === null ? `${step} failed` : `${step} exited ${status}`)
    this.name = 'StepFailure'
    this.step = step
    this.status = status
    this.tail = tail
    this.hint = hint
  }
}

export function formatStepFailure(failure: StepFailure): string[] {
  let lines = [
    `Failed step: ${failure.step}` + (failure.status === null ? '' : ` (exit ${failure.status})`),
  ]
  let tail = failure.tail.trim()
  if (tail) {
    lines.push('Last output:')
    for (let line of tail.split('\n').slice(-TAIL_LINES)) lines.push(`  ${line}`)
  }
  if (failure.hint) lines.push('', failure.hint)
  return lines
}
