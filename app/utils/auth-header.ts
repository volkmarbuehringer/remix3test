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
