## 1. Replace inline IP chain with sourceIp()

- [x] 1.1 Import `sourceIp` from `../../lib/request-ip.ts` in `app/middleware/global-rate-limit.ts`
- [x] 1.2 Replace the inline `if (trustProxy) { ... } else { ... }` block with `sourceIp(context.request) || 'unknown'`
- [x] 1.3 Remove the `trustProxy` option parameter and its default (`process.env.NODE_ENV === 'production'`)
- [x] 1.4 Remove the `skip` option's dependency on `trustProxy` (it's independent)

## 2. Verify

- [x] 2.1 Run `tsc --noEmit` — confirm no type errors
- [x] 2.2 Run tests — confirm no regressions
