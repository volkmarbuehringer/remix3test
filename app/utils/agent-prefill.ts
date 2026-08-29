// NOTE: Since the conventional render() middleware (upstream #11607), frame
// sub-requests copy ALL outer request headers minus hop-by-hop/sec-fetch-* —
// `X-Agent-Prefill` rides along into nested SSR frame resolutions. Keep
// prefill-consuming routes free of nested <Frame> rendering, or strip the
// header for nested sub-requests before relying on it there.
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
