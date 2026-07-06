export function messageContentToText(content: unknown): string {
  if (typeof content === 'string') return content
  if (content && typeof content === 'object') {
    let obj = content as Record<string, unknown>
    if (Array.isArray(obj.parts)) {
      let texts: string[] = []
      for (let part of obj.parts) {
        let p = part as Record<string, unknown>
        if (p.type === 'text' && typeof p.text === 'string') {
          texts.push(p.text)
        }
      }
      return texts.join('\n')
    }
    if (typeof obj.text === 'string') return obj.text
  }
  if (Array.isArray(content)) {
    return content
      .map((c) => messageContentToText(c))
      .filter(Boolean)
      .join('\n')
  }
  return ''
}
