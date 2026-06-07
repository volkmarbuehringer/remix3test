## Context

The app currently uses `http.createServer` via `remix/node-fetch-server`'s `createRequestListener`. In production on a bare-IP VPS, HTTPS is required for security but buying a domain for cert issuance is not worth the recurring cost. `createRequestListener` already auto-detects TLS via `req.socket.encrypted`, so the Node.js HTTPS support is already wired at the request handling level — only the server creation needs to change.

## Goals / Non-Goals

**Goals:**
- Serve HTTPS in production (NODE_ENV=production) using self-signed certificates
- Keep development workflow unchanged (HTTP on localhost)
- Keep the single `server.ts` entry point — no separate server.new or server.prod.ts
- Use existing cert files (`key.pem`, `cert.pem`) from project root

**Non-Goals:**
- HTTP→HTTPS redirect (not needed for narrow audience)
- Let's Encrypt or ACME integration
- Domain purchase or DNS configuration
- Port 80 vs 443 decision (port stays configurable via $PORT)

## Decisions

- **Conditional on NODE_ENV**: Follows the project's existing pattern (used in rate limits, email verification, demo accounts, etc.)
- **Hardcoded paths**: Certs live at `./key.pem` and `./cert.pem` in project root. Simple, no env var overhead. The VPS operator generates them once per year.
- **https.createServer directly**: No wrapper library needed. `createRequestListener` is already compatible — just swap the server constructor.
- **Self-signed certs**: 1-year validity is longer than Let's Encrypt's 90-day certs, making it lower-touch for a narrow-audience service.

## Risks / Trade-offs

- Browser warning on every visit → Acceptable for narrow audience. Firefox allows permanent exception.
- Cert expires after 1 year → Less frequent than LE's 90-day renewal. Manual regeneration is fine.
- Cert bound to IP via SAN → If VPS provider changes the IP, cert breaks and must be regenerated.
- Private key in project root → Should not be committed to git. Already covered by `.gitignore` if present.
