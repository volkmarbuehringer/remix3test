# Bun Entrypoint: Reuse the Router

**Source:** `remix3-bun-runtime`

**Extracted:** 2026-09-19

**Context:** `server.bun.ts` is the Bun entrypoint alongside `server.ts`; both must share one request pipeline and stamp the same trusted client IP.

## Problem

Duplicating the router/DB bootstrap and the `X-Client-Ip` stamping in `server.bun.ts` lets the two entrypoints drift. Bun accepts Fetch handlers directly (no Node adapter), so the only difference should be how the trusted socket address is read.

## Solution

`server.bun.ts` calls `Bun.serve(...)` with the same router/DB bootstrap as `server.ts`. Extract the try/catch + `X-Client-Ip` stamping into a shared `createServerHandler(router)` so both entries share one pipeline. Take the trusted IP from the `fetch(request, server)` second argument:

```ts
const server = Bun.serve({
  port,
  hostname,
  development: !isProduction,
  ...(isProduction
    ? { tls: { key: fs.readFileSync('key.pem'), cert: fs.readFileSync('cert.pem') } }
    : {}),
  fetch(request, runtime) {
    return handleRequest(request, runtime.requestIP(request)?.address ?? '')
  },
})
```

`server.requestIP()` is the TCP socket address, so `X-Client-Ip` stays unspoofable (see `security-gotchas` (`references/two-tier-ip-trust-model.md`)). Bun auto-loads `.env` — no `--env-file` flag.
