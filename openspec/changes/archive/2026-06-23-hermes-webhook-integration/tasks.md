## 1. Route & Controller

- [x] 1.1 Add `POST /app-webhook/:token` route definition in `app/routes.ts`
- [x] 1.2 Create `app/actions/app-webhook/controller.tsx` with token validation, payload insertion, and hermes forwarding
- [x] 1.3 Wire the new route in `app/router.ts` (import + `router.post()`)

## 2. Middleware & Wiring

- [x] 2.1 Extend `app/middleware/skip-csrf.ts` to also skip CSRF for `/app-webhook/` paths
- [x] 2.2 Update `server.ts` if the new route needs its own env var registration (optional — skipped, reuses WEBHOOK_TOKEN)

## 3. Testing

- [x] 3.1 Write tests for the new controller (success path, auth failure, oversized payload, hermes timeout)
