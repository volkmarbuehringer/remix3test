import * as fs from 'node:fs'

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
 * Resolution order:
 *  1. `PUBLIC_ORIGIN` — an explicit base URL. An IP + port is fine; DNS is not
 *     required (e.g. `https://203.0.113.5:44100`).
 *  2. A single-line file (default `tmp/public-origin`, override with
 *     `PUBLIC_ORIGIN_FILE`). This fits a Cloudflare quick tunnel whose
 *     `*.trycloudflare.com` hostname changes on every restart: write the current
 *     URL to the file when the tunnel starts. The file's mtime is watched, so a
 *     rewrite is picked up without restarting the app.
 *  3. Outside production only: the request origin, so localhost/HMR keep working.
 *
 * In production with neither (1) nor (2), this throws — it never falls back to
 * the attacker-controllable Host header.
 */
const DEFAULT_ORIGIN_FILE = 'tmp/public-origin'

let fileCache: { path: string; mtimeMs: number; value: string } | undefined

function cleanOrigin(value: string): string {
  return value.trim().replace(/\/+$/, '')
}

function readOriginFile(): string | undefined {
  let filePath = process.env.PUBLIC_ORIGIN_FILE?.trim() || DEFAULT_ORIGIN_FILE
  try {
    let stat = fs.statSync(filePath)
    if (fileCache?.path === filePath && fileCache.mtimeMs === stat.mtimeMs) {
      return fileCache.value
    }
    let value = fs
      .readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0)
    if (!value) return undefined
    let cleaned = cleanOrigin(value)
    fileCache = { path: filePath, mtimeMs: stat.mtimeMs, value: cleaned }
    return cleaned
  } catch {
    return undefined
  }
}

/**
 * The server-configured origin, if one is available (via `PUBLIC_ORIGIN` or the
 * origin file). Returns `undefined` when neither is present.
 */
export function configuredPublicOrigin(): string | undefined {
  let configured = process.env.PUBLIC_ORIGIN?.trim()
  if (configured) return cleanOrigin(configured)
  return readOriginFile()
}

export function getPublicOrigin(requestOrigin: string): string {
  let origin = configuredPublicOrigin()
  if (origin) return origin

  if (process.env.NODE_ENV !== 'production') return requestOrigin

  throw new Error(
    'No trusted public origin configured; refusing to build absolute links from the ' +
      'attacker-controllable Host header. Set PUBLIC_ORIGIN or write the current URL to ' +
      `${process.env.PUBLIC_ORIGIN_FILE?.trim() || DEFAULT_ORIGIN_FILE}.`,
  )
}
