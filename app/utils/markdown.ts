/**
 * Minimal, safe markdown for agent chat bubbles.
 *
 * The support agent streams plain text; this parser adds light formatting
 * (headings, lists, code, bold/italic, links) without ever injecting raw HTML.
 * Links are restricted to http(s) so an agent response can never produce a
 * `javascript:` or `data:` href.
 */

export type InlineToken =
  | { type: 'text'; text: string }
  | { type: 'bold'; children: InlineToken[] }
  | { type: 'italic'; children: InlineToken[] }
  | { type: 'code'; text: string }
  | { type: 'link'; text: string; href: string }

export type MarkdownBlock =
  | { type: 'paragraph'; inline: InlineToken[] }
  | { type: 'heading'; level: number; inline: InlineToken[] }
  | { type: 'list'; ordered: boolean; items: InlineToken[][] }
  | { type: 'code'; text: string }
  | { type: 'hr' }

const CODE_SPAN = /^`([^`\n]+)`/
const LINK = /^\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/
const AUTOLINK = /^(https?:\/\/[^\s<>]+)/
const BOLD = /^\*\*([^*]+)\*\*/
const ITALIC = /^\*([^*\n]+)\*/

const HEADING = /^(#{1,6})\s+(.+)$/
const BULLET = /^\s*[-*+]\s+(.+)$/
const ORDERED = /^\s*\d+[.)]\s+(.+)$/
const HR = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/
const FENCE = /^```/

/** Strips trailing punctuation from an autolinked URL. */
function trimAutolink(url: string): string {
  return url.replace(/[.,;:!?)\]}"']+$/, '')
}

export function parseInline(text: string): InlineToken[] {
  let tokens: InlineToken[] = []
  let i = 0
  let buffer = ''

  function flush() {
    if (buffer) {
      tokens.push({ type: 'text', text: buffer })
      buffer = ''
    }
  }

  while (i < text.length) {
    let rest = text.slice(i)
    let match: RegExpExecArray | null

    if ((match = CODE_SPAN.exec(rest))) {
      flush()
      tokens.push({ type: 'code', text: match[1]! })
      i += match[0].length
      continue
    }
    if ((match = LINK.exec(rest))) {
      flush()
      tokens.push({ type: 'link', text: match[1]!, href: match[2]! })
      i += match[0].length
      continue
    }
    if ((match = AUTOLINK.exec(rest))) {
      flush()
      let href = trimAutolink(match[1]!)
      tokens.push({ type: 'link', text: href, href })
      // Leave any stripped trailing punctuation for the next text token.
      i += match[0].length - (match[1]!.length - href.length)
      continue
    }
    if ((match = BOLD.exec(rest))) {
      flush()
      tokens.push({ type: 'bold', children: parseInline(match[1]!) })
      i += match[0].length
      continue
    }
    if ((match = ITALIC.exec(rest))) {
      flush()
      tokens.push({ type: 'italic', children: parseInline(match[1]!) })
      i += match[0].length
      continue
    }

    buffer += text[i]
    i++
  }

  flush()
  return tokens
}

function isBlockStart(line: string): boolean {
  return HEADING.test(line) || HR.test(line) || BULLET.test(line) || ORDERED.test(line)
}

export function parseMarkdown(text: string): MarkdownBlock[] {
  let lines = text.replace(/\r\n/g, '\n').split('\n')
  let blocks: MarkdownBlock[] = []
  let i = 0

  while (i < lines.length) {
    let line = lines[i]!
    if (line.trim() === '') {
      i++
      continue
    }

    if (FENCE.test(line.trim())) {
      let codeLines: string[] = []
      i++
      while (i < lines.length && !FENCE.test(lines[i]!.trim())) {
        codeLines.push(lines[i]!)
        i++
      }
      i++
      blocks.push({ type: 'code', text: codeLines.join('\n') })
      continue
    }

    if (HR.test(line)) {
      blocks.push({ type: 'hr' })
      i++
      continue
    }

    let heading = HEADING.exec(line)
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1]!.length, inline: parseInline(heading[2]!) })
      i++
      continue
    }

    let bullet = BULLET.exec(line)
    let ordered = ORDERED.exec(line)
    if (bullet || ordered) {
      let isOrdered = Boolean(ordered)
      let items: InlineToken[][] = []
      let re = isOrdered ? ORDERED : BULLET
      while (i < lines.length) {
        let item = re.exec(lines[i]!)
        if (!item) break
        items.push(parseInline(item[1]!))
        i++
      }
      blocks.push({ type: 'list', ordered: isOrdered, items })
      continue
    }

    let paragraph: string[] = [line]
    i++
    while (i < lines.length) {
      let next = lines[i]!
      if (next.trim() === '' || FENCE.test(next.trim()) || isBlockStart(next)) break
      paragraph.push(next)
      i++
    }
    blocks.push({ type: 'paragraph', inline: parseInline(paragraph.join(' ')) })
  }

  return blocks
}
