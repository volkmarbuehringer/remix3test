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

export async function verifyWebhookHmac(
  request: Request,
  secret: string,
): Promise<Response | null> {
  let signature = request.headers.get('X-Hub-Signature-256')
  if (!signature) return null

  let prefix = 'sha256='
  if (!signature.startsWith(prefix)) {
    return new Response('Invalid signature format', { status: 401 })
  }
  let provided = signature.slice(prefix.length)

  let encoder = new TextEncoder()
  let keyData = encoder.encode(secret)

  let key = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  )
  let body = await request.clone().text()
  let expectedBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  let expected = Array.from(new Uint8Array(expectedBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  if (provided.length !== expected.length) {
    return new Response('Unauthorized', { status: 401 })
  }

  let equal = provided.length === expected.length
  for (let i = 0; i < provided.length; i++) {
    if (provided[i] !== expected[i]) equal = false
  }
  if (!equal) {
    return new Response('Unauthorized', { status: 401 })
  }
  return null
}

export const SENSITIVE_HEADERS = new Set([
  'authorization', 'cookie', 'set-cookie', 'proxy-authorization',
  'x-api-key', 'x-auth-token', 'www-authenticate', 'x-client-ip',
])
