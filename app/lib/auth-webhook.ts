export function authenticateWebhook(request: Request): string | Response {
  let authHeader = request.headers.get('Authorization')
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401 })
  }
  let space = authHeader.indexOf(' ')
  if (space === -1) {
    return new Response('Unauthorized', { status: 401 })
  }
  let scheme = authHeader.slice(0, space)
  if (scheme.toLowerCase() !== 'bearer') {
    return new Response('Unauthorized', { status: 401 })
  }
  let token = authHeader.slice(space + 1)
  if (!token) {
    return new Response('Unauthorized', { status: 401 })
  }
  let expected = process.env.WEBHOOK_TOKEN
  if (expected === undefined || expected === '') {
    return new Response('Service unavailable', { status: 503 })
  }
  if (token !== expected) {
    return new Response('Unauthorized', { status: 401 })
  }
  return token
}

export const SENSITIVE_HEADERS = new Set([
  'authorization', 'cookie', 'set-cookie', 'proxy-authorization',
  'x-api-key', 'x-auth-token', 'www-authenticate', 'x-client-ip',
])
