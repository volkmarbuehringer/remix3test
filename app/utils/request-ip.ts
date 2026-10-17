/**
 * Untrusted source-IP fallback chain for logging/audit/analytics only. Every
 * value here is client-spoofable — never use it for security decisions (see
 * `connectionIp`).
 */
export function sourceIp(request: Request): string {
  return (
    request.headers.get('X-Client-Ip') ??
    request.headers.get('Cf-Connecting-Ip') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    request.headers.get('X-Real-Ip') ??
    ''
  )
}

/**
 * Trusted client IP for security decisions (localhost guards, login rate
 * limits). Trustworthy only because the server boundary overwrites
 * `X-Client-Ip` with the TCP socket address on every request
 * (`app/utils/server-handler.ts`) — a client-supplied value never survives.
 * With `trustProxy: true` (dev HMR only), the boundary derives the value from
 * forwarded headers instead and this tier is no longer spoof-proof.
 */
export function connectionIp(request: Request): string {
  return request.headers.get('X-Client-Ip') ?? ''
}

export function isLocalhost(ip: string): boolean {
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1'
}
