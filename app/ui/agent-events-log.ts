import { html, type SafeHtml } from 'remix/html-template'
import { theme } from './theme/theme.ts'

export type RowKind = 'success' | 'active' | 'info' | 'error'

export type PipelineRow = {
  kind: RowKind
  text: string
  time: string
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function inferKind(text: string): RowKind {
  let t = (text || '').trim()
  if (t.startsWith('✓')) return 'success'
  if (t.startsWith('▶')) return 'active'
  if (t.startsWith('!')) return 'error'
  return 'info'
}

export function kindGlyph(kind: RowKind): string {
  switch (kind) {
    case 'success':
      return '✓'
    case 'active':
      return '▶'
    case 'error':
      return '!'
    default:
      return '•'
  }
}

export function kindColor(kind: RowKind): string {
  switch (kind) {
    case 'success':
      return theme.colors.success.background
    case 'active':
      return theme.colors.action.primary.background
    case 'error':
      return theme.colors.action.danger.background
    default:
      return theme.colors.text.muted
  }
}

export function pipelineRowHtml(row: PipelineRow): SafeHtml {
  let badgeColor = kindColor(row.kind)
  let textColor =
    row.kind === 'error' ? theme.colors.action.danger.background : theme.colors.text.primary
  return html`<div
    style="display:flex;align-items:baseline;gap:.5rem;padding:.25rem 0;font-size:.8125rem;line-height:1.4"
  >
    <span style="flex:0 0 1rem;text-align:center;font-weight:600;color:${badgeColor}"
      >${kindGlyph(row.kind)}</span
    ><span
      style="flex:0 0 4.5rem;font-family:${theme.fontFamily.mono};font-size:.75rem;color:${theme.colors.text.muted}"
      >${row.time}</span
    ><span style="color:${textColor};word-break:break-word">${row.text}</span>
  </div>`
}

export function pipelineLogHtml(rows: PipelineRow[]): SafeHtml {
  let body = rows.map(pipelineRowHtml)
  return html`<div
    id="ae-pipeline-log"
    style="display:flex;flex-direction:column;height:100%;overflow-y:auto;padding:1rem 1.25rem;box-sizing:border-box"
  >
    ${body}
  </div>`
}
