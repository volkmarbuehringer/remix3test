/**
 * Signing secrets for the session cookie, newest first.
 *
 * `SESSION_SECRET` signs every new cookie. `SESSION_SECRET_PREVIOUS` is an
 * optional comma-separated list of retired secrets that can still verify a
 * cookie but never sign one, so rotating the primary secret does not invalidate
 * every live session (guide 10 §"Cookie configuration and secret rotation").
 *
 * Blank entries and a previous value equal to the current one are dropped:
 * `createCookie` tries the list in order, and a duplicate adds a second HMAC
 * check for no benefit.
 */
export function sessionSecrets(primary: string, previous: string | undefined): string[] {
  let retired = (previous ?? '')
    .split(',')
    .map((secret) => secret.trim())
    .filter((secret) => secret.length > 0 && secret !== primary)

  return [primary, ...new Set(retired)]
}
