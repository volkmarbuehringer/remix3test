## Why

Serve the app over HTTPS in production without requiring a purchased domain. Self-signed certificates are acceptable for a narrow-audience service on a bare IP address — a domain is not worth the recurring cost for this use case, and HTTPS is a security requirement.

## What Changes

- `server.ts` switches from `http.createServer` to `https.createServer` when `NODE_ENV === 'production'`
- Self-signed certs (`key.pem`, `cert.pem`) are loaded from hardcoded project root paths in production
- Development (`NODE_ENV !== 'production'`) continues using plain HTTP as today
- Startup script generates self-signed certificates for the VPS IP address

## Capabilities

### New Capabilities
- `tls-server`: HTTPS server support with self-signed certificates for production deployments

### Modified Capabilities

None — no existing specs are affected.

## Impact

- `server.ts` — conditional HTTPS/TLS logic added
- `key.pem`, `cert.pem` — certificate files needed in project root on production
- README (optional) — cert generation instructions for VPS setup
