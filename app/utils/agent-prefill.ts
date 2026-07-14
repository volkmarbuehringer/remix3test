export function readAgentPrefill(request: Request): Record<string, string> | undefined {
  let raw = request.headers.get('X-Agent-Prefill')
  if (!raw) return undefined
  try {
    let json = Buffer.from(raw, 'base64').toString('utf-8')
    let parsed = JSON.parse(json)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed) &&
      Object.values(parsed).every((v) => typeof v === 'string')
    ) {
      return parsed as Record<string, string>
    }
  } catch {
    /* invalid prefill data — ignore */
  }
  return undefined
}
