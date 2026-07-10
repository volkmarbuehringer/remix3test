# Session Cookie `secure` Flag

## Requirements

The session cookie `Secure` attribute must be:

- `true` in production (HTTPS-only)
- `false` in development/test (allow HTTP)

## Behavior

| NODE_ENV    | secure | Cookie sent over HTTP |
| ----------- | ------ | --------------------- |
| production  | true   | No                    |
| development | false  | Yes                   |
| test        | false  | Yes                   |
| (unset)     | false  | Yes                   |

## Affected File

`app/middleware/session.ts` line 21 — the `secure` property of the `createCookie('session', ...)` options.
