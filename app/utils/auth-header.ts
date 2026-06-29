import { timingSafeEqual } from 'node:crypto'

export function parseBearerToken(request: Request): string | null {
  let authHeader = request.headers.get('Authorization')
  if (!authHeader) return null
  let space = authHeader.indexOf(' ')
  if (space === -1) return null
  let scheme = authHeader.slice(0, space)
  if (scheme.toLowerCase() !== 'bearer') return null
  let token = authHeader.slice(space + 1)
  return token || null
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}
