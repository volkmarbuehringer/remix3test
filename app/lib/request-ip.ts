export function sourceIp(request: Request): string {
  return (
    request.headers.get('X-Client-Ip') ??
    request.headers.get('Cf-Connecting-Ip') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    request.headers.get('X-Real-Ip') ??
    ''
  )
}

export function connectionIp(request: Request): string {
  return request.headers.get('X-Client-Ip') ?? ''
}

export function isLocalhost(ip: string): boolean {
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1'
}
