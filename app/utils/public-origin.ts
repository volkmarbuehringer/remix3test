/**
 * Origin used to build absolute, user-facing links (email verification and
 * password reset).
 *
 * This MUST NOT be derived from `context.url.origin`: the request URL host is
 * taken from the client-supplied `Host` header (see
 * `remix/node-fetch-server`'s `getRequestHost`), so an attacker can send
 * `Host: attacker.example` to `POST /auth/forgotten` and have the emailed
 * reset link point at their domain — leaking the single-use token and allowing
 * account takeover (CWE-644, password-reset link poisoning).
 *
 * `PUBLIC_ORIGIN` is enforced at boot in production (see server.ts /
 * server.bun.ts). In development the request origin is used so localhost and
 * HMR keep working without extra configuration.
 */
export function getPublicOrigin(requestOrigin: string): string {
  let configured = process.env.PUBLIC_ORIGIN?.trim()
  if (configured) return configured.replace(/\/+$/, '')

  if (process.env.NODE_ENV !== 'production') return requestOrigin

  // Fail closed rather than trust a header value in production. The boot-time
  // check should make this unreachable; it is a defensive second layer.
  throw new Error(
    'PUBLIC_ORIGIN must be set when NODE_ENV=production; refusing to build absolute links from ' +
      'the attacker-controllable Host header.',
  )
}
