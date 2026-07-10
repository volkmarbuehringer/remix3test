const HTML_ENTITIES: Record<string, string> = {
  '&#39;': "'",
  '&#039;': "'",
  '&#x27;': "'",
  '&#X27;': "'",
  '&#34;': '"',
  '&quot;': '"',
  '&lt;': '<',
  '&gt;': '>',
  '&amp;': '&',
}

const entityPattern = /&#?[a-zA-Z0-9]+;/g

export function decodeHtml(text: string): string {
  return text.replace(entityPattern, (match) => HTML_ENTITIES[match] ?? match)
}
