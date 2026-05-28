<!-- Context: sse/guides/security-headers | Priority: medium | Version: 1.0 | Updated: 2026-03-22 -->

# SSE Security Headers

Security considerations and headers for SSE endpoints.

## Required Headers

```typescript
return new Response(stream, {
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'X-Accel-Buffering': 'no',
  },
})
```

## Header Reference

| Header                   | Value               | Purpose                 |
| ------------------------ | ------------------- | ----------------------- |
| `Content-Type`           | `text/event-stream` | SSE content type        |
| `Cache-Control`          | `no-cache`          | Prevent caching         |
| `X-Content-Type-Options` | `nosniff`           | Prevent MIME sniffing   |
| `X-Accel-Buffering`      | `no`                | Disable proxy buffering |

## Header Details

### X-Content-Type-Options: nosniff

Prevents browsers from MIME-sniffing a response away from the declared content-type:

```
X-Content-Type-Options: nosniff
```

**Without this header**, a browser might interpret SSE data as JavaScript.

### X-Accel-Buffering: no

Disables buffering by nginx or other reverse proxies:

```
X-Accel-Buffering: no
```

**Without this header**, nginx buffers SSE responses, causing delays.

### Connection: keep-alive

While often automatic, explicitly setting this improves clarity:

```typescript
'Connection': 'keep-alive'
```

## CORS Considerations

For cross-origin SSE, configure CORS headers:

```typescript
// If SSE endpoint is on different origin
'Access-Control-Allow-Origin': 'https://trusted-domain.com'
'Access-Control-Allow-Credentials': 'true'
```

**For same-origin** (typical case): CORS headers not needed.

## Content Security Policy

If using CSP headers, ensure SSE connections are allowed:

```typescript
'Content-Security-Policy': "default-src 'self'; connect-src 'self' ws: wss:"
```

## Input Validation

All user input must be sanitized:

```typescript
function sanitizeRoom(room: string | null): string {
  return (room ?? 'default')
    .slice(0, 50) // Length limit
    .replace(/[^\w-]/g, '') // Only alphanumeric and dash
  return sanitized || 'default'
}

function sanitizeUsername(username: string | null): string {
  return (username ?? 'anonymous').slice(0, 30).replace(/[^\w]/g, '') // Only alphanumeric
  return sanitized || 'anonymous'
}

function sanitizeMessage(message: string | null): string {
  return (message ?? '')
    .slice(0, 1000) // Length limit
    .replace(/[<>'"&]/g, '') // Remove dangerous chars
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control chars
    .trim()
}
```

## Injection Prevention

| Attack                     | Mitigation                   |
| -------------------------- | ---------------------------- |
| XSS in username            | Strip `<>` and quotes        |
| HTML injection in messages | Remove dangerous characters  |
| Command injection          | Whitelist allowed characters |
| Buffer overflow            | Enforce length limits        |

## Rate Limiting

Prevent abuse with rate limiting:

```typescript
const RATE_LIMIT_MS = 500 // Minimum between messages

let rateKey = `${username}:${room}`
let now = Date.now()
let lastTime = rateLimitMap.get(rateKey) ?? 0

if (now - lastTime < RATE_LIMIT_MS) {
  return redirect(context.url.pathname) // Rate limited
}
rateLimitMap.set(rateKey, now)
```

## Session Security

Prevent session hijacking with login tracking:

```typescript
// Global map prevents duplicate sessions
if (loggedInUsers.has(username)) {
  // Reject connection
  return errorResponse
}
loggedInUsers.set(username, controller)
```

## Development vs Production

| Setting     | Development       | Production       |
| ----------- | ----------------- | ---------------- |
| CORS        | `*` (or disabled) | Specific origins |
| CSP         | Relaxed           | Strict           |
| Rate limits | Higher            | Enforced         |
| Logging     | Verbose           | Minimal          |

## Security Checklist

- [ ] `X-Content-Type-Options: nosniff` set
- [ ] `X-Accel-Buffering: no` set (if behind proxy)
- [ ] All user input sanitized
- [ ] Rate limiting enabled
- [ ] Login tracking prevents duplicates
- [ ] Message length limits enforced
- [ ] Control characters stripped
- [ ] Dangerous HTML chars removed

## 📂 Codebase References

**Security headers**: `demos/sse/app/router.tsx` - messages() handler
**Input sanitization**: `demos/sse/app/router.tsx` - sanitize\* functions
**Rate limiting**: `development/remix3/guides/rate-limiting.md`
