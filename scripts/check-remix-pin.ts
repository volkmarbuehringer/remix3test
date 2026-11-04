import * as fs from 'node:fs'
import * as path from 'node:path'

// ---------------------------------------------------------------------------
// Check that the remix preview pin is still installable.
//
// Since #12174, upstream publishes each `main` preview build as a GitHub
// release in `remix-run/previews`, tagged
// `v0.<date>.<time>-main-<source-sha-8>`, with one tarball asset per package.
// Main releases are pruned after roughly seven days (the newest is kept), so a
// lockfile pointed at an old release URL installs until it suddenly 404s.
//
// This check:
//   1. reads the two release asset URLs from package.json,
//   2. verifies pnpm-lock.yaml resolves every remix ref to that same release
//      tag (a half-applied update fails before any network call),
//   3. HEADs both URLs (404/410 means the pin expired),
//   4. reads the latest main preview release and warns when the pin is not the
//      newest release or is older than the five-day refresh window.
//
// It is dependency-free and offline-safe: network/HTTP failures that are not
// the tarball's own 404 are warnings, not failures. `--strict` upgrades the
// refresh-window warnings (age, missing release) to failures.
// ---------------------------------------------------------------------------

const ROOT = path.resolve(import.meta.dirname, '..')
const PACKAGE_PATH = path.join(ROOT, 'package.json')
const LOCK_PATH = path.join(ROOT, 'pnpm-lock.yaml')
const PREVIEW_REPOSITORY = 'remix-run/previews'
const PREVIEW_API = `https://api.github.com/repos/${PREVIEW_REPOSITORY}`
const PINNED_PACKAGES = ['remix', '@remix-run/ui'] as const
const TARBALL_FILES: Record<(typeof PINNED_PACKAGES)[number], string> = {
  remix: 'remix',
  '@remix-run/ui': 'ui',
}
const RELEASE_SPEC_RE =
  /^https:\/\/github\.com\/remix-run\/previews\/releases\/download\/(v0\.\d{8}\.\d{1,6}-main-([0-9a-f]{8}))\/(remix|ui)\.tgz$/
const RELEASE_TAG_RE = /^v0\.\d{8}\.\d{1,6}-main-([0-9a-f]{8})$/
const LOCK_RELEASE_REF_RE = /github\.com\/remix-run\/previews\/releases\/download\/([^/]+)\//g
const LOCK_LEGACY_TARBALL_REF_RE =
  /raw\.githubusercontent\.com\/remix-run\/remix\/preview\/main\/t\/([0-9a-f]{8})\//g
const LOCK_CODELOAD_REF_RE = /codeload\.github\.com\/remix-run\/remix\/tar\.gz\/([0-9a-f]{40})/g
const LOCK_PACKAGE_KEY_RE = /^ {2}'(@remix-run\/[^@'\s]+)@([^']+)':$/gm
const REFRESH_AFTER_DAYS = 5
const RETENTION_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000
const REQUEST_TIMEOUT_MS = 15_000
const USER_AGENT = 'remix3test-check-remix-pin'

type Options = {
  strict: boolean
}

type ReleasePin = {
  name: (typeof PINNED_PACKAGES)[number]
  url: string
  tag: string
  sha: string
}

type HeadResult = {
  name: string
  url: string
  status: 'ok' | 'expired' | 'skipped'
  detail: string
}

type ReleaseAsset = {
  name: string
  browser_download_url: string
}

type PreviewRelease = {
  tag_name: string
  name: string
  draft: boolean
  created_at: string
  published_at: string | null
  assets: ReleaseAsset[]
}

type LockPackageRef = {
  name: string
  version: string
}

type LockState = {
  releaseRefs: number
  releaseTags: string[]
  legacyTarballRefs: number
  legacyTarballPrefixes: string[]
  codeloadRefs: number
  codeloadBuilds: string[]
  packageRefs: LockPackageRef[]
}

function usage(): void {
  console.log(`Usage: npm run remix:pin:check -- [options]

Verify the remix preview release assets pinned in package.json still exist and
are inside the five-day refresh window. Also verifies pnpm-lock.yaml resolves
every remix ref to the same release. Exits nonzero on lock drift or when the pin
has expired (HTTP 404/410) so CI catches it before an install fails.

Options:
  --strict   Fail on refresh-window warnings (pin is not the newest main
             preview or is older than 5 days), not just on 404s
  -h, --help Show this help

Network failures are warnings: the check is safe to run offline.
`)
}

function parseOptions(argv: string[]): Options {
  let options: Options = { strict: false }

  for (let arg of argv) {
    if (arg === '--strict') options.strict = true
    else if (arg === '-h' || arg === '--help') {
      usage()
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${arg} (try --help)`)
    }
  }

  return options
}

function readPins(): ReleasePin[] {
  let packageJson = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8')) as {
    dependencies?: Record<string, string>
  }
  let pins: ReleasePin[] = []

  for (let name of PINNED_PACKAGES) {
    let spec = packageJson.dependencies?.[name]
    if (!spec) throw new Error(`${name} is missing from package.json dependencies`)

    let match = RELEASE_SPEC_RE.exec(spec)
    if (!match) {
      throw new Error(
        `${name} is not pinned to a remix preview release (got ${spec}). ` +
          'Expected https://github.com/remix-run/previews/releases/download/<tag>/<pkg>.tgz; ' +
          'run npm run update:remix.',
      )
    }

    let tag = match[1]!
    let sha = match[2]!
    let file = match[3]!
    if (file !== TARBALL_FILES[name]) {
      throw new Error(`${name} points at an unexpected tarball: ${spec}`)
    }
    pins.push({ name, url: spec, tag, sha })
  }

  let tags = [...new Set(pins.map((pin) => pin.tag))]
  if (tags.length !== 1) {
    throw new Error(
      `remix and @remix-run/ui point at different releases (${tags.join(', ')}); ` +
        'update them together.',
    )
  }

  return pins
}

function short(value: string): string {
  return value.slice(0, 10)
}

function readLockState(lock: string): LockState {
  let releaseTags = [...lock.matchAll(LOCK_RELEASE_REF_RE)]
    .map((match) => match[1])
    .filter((tag): tag is string => Boolean(tag))
  let legacyTarballPrefixes = [...lock.matchAll(LOCK_LEGACY_TARBALL_REF_RE)]
    .map((match) => match[1])
    .filter((prefix): prefix is string => Boolean(prefix))
  let codeloadBuilds = [...lock.matchAll(LOCK_CODELOAD_REF_RE)]
    .map((match) => match[1])
    .filter((build): build is string => Boolean(build))
  let packageRefs = [...lock.matchAll(LOCK_PACKAGE_KEY_RE)]
    .map((match) => ({ name: match[1] ?? '', version: match[2] ?? '' }))
    .filter((ref) => ref.name.length > 0 && ref.version.length > 0)

  return {
    releaseRefs: releaseTags.length,
    releaseTags: [...new Set(releaseTags)],
    legacyTarballRefs: legacyTarballPrefixes.length,
    legacyTarballPrefixes: [...new Set(legacyTarballPrefixes)],
    codeloadRefs: codeloadBuilds.length,
    codeloadBuilds: [...new Set(codeloadBuilds)],
    packageRefs,
  }
}

/**
 * A half-applied update can leave package.json on one release while the lock
 * still carries the old one (or a mix of release, retained-tarball, and
 * codeload refs). Catch that locally and before `pnpm install`, so the fix is
 * always the same `update:remix` run instead of an opaque resolution failure.
 */
function checkLock(tag: string, pins: ReleasePin[]): boolean {
  let lock: string
  try {
    lock = fs.readFileSync(LOCK_PATH, 'utf8')
  } catch (error) {
    let detail = error instanceof Error ? error.message : String(error)
    console.error(`fail    cannot read pnpm-lock.yaml (${detail}); run npm install`)
    return false
  }

  let state = readLockState(lock)
  let problems: string[] = []

  if (state.codeloadRefs > 0) {
    problems.push(
      `pnpm-lock.yaml still has ${state.codeloadRefs} git-hosted remix refs ` +
        `(${state.codeloadBuilds.map(short).join(', ')}); run npm run update:remix`,
    )
  }
  if (state.legacyTarballRefs > 0) {
    problems.push(
      `pnpm-lock.yaml still has ${state.legacyTarballRefs} retained-preview-tarball refs ` +
        `(${state.legacyTarballPrefixes.map((prefix) => `t/${prefix}`).join(', ')}); ` +
        'run npm run update:remix',
    )
  }
  if (state.releaseRefs === 0) {
    problems.push('pnpm-lock.yaml has no preview release tarball refs; run npm run update:remix')
  } else if (state.releaseTags.length !== 1 || state.releaseTags[0] !== tag) {
    problems.push(
      `pnpm-lock.yaml tarball refs span ` +
        `${state.releaseTags.join(', ') || 'none'} ` +
        `(${state.releaseRefs} refs); expected ${tag}. Run npm run update:remix`,
    )
  }

  let expectedPrefix = `https://github.com/remix-run/previews/releases/download/${tag}/`
  let packageRefsOutsidePin = state.packageRefs.filter(
    (ref) => !ref.version.startsWith(expectedPrefix),
  )
  if (state.packageRefs.length === 0) {
    problems.push('pnpm-lock.yaml has no @remix-run/* package entries; run npm run update:remix')
  } else if (packageRefsOutsidePin.length > 0) {
    let examples = packageRefsOutsidePin
      .slice(0, 3)
      .map((ref) => `${ref.name}@${short(ref.version)}`)
      .join(', ')
    problems.push(
      `pnpm-lock.yaml has ${packageRefsOutsidePin.length} @remix-run/* package entries ` +
        `outside ${tag} (${examples}${packageRefsOutsidePin.length > 3 ? ', …' : ''}); ` +
        'run npm run update:remix',
    )
  }

  for (let pin of pins) {
    if (!lock.includes(pin.url)) {
      problems.push(`pnpm-lock.yaml is missing the pinned ${pin.name} URL: ${pin.url}`)
    }
  }

  if (problems.length > 0) {
    for (let problem of problems) console.error(`fail    ${problem}`)
    return false
  }

  console.log(`ok      lock: ${state.releaseRefs} release tarball refs at ${tag}, no legacy refs`)
  return true
}

function networkMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'TimeoutError') return 'timed out'
    return error.message
  }
  return String(error)
}

async function headPin(pin: ReleasePin): Promise<HeadResult> {
  try {
    let response = await fetch(pin.url, {
      method: 'HEAD',
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (response.ok) {
      return { name: pin.name, url: pin.url, status: 'ok', detail: `HTTP ${response.status}` }
    }
    if (response.status === 404 || response.status === 410) {
      return {
        name: pin.name,
        url: pin.url,
        status: 'expired',
        detail: `HTTP ${response.status}`,
      }
    }
    return {
      name: pin.name,
      url: pin.url,
      status: 'skipped',
      detail: `HTTP ${response.status}`,
    }
  } catch (error) {
    return {
      name: pin.name,
      url: pin.url,
      status: 'skipped',
      detail: networkMessage(error),
    }
  }
}

function printHeadResult(result: HeadResult): void {
  if (result.status === 'ok') {
    console.log(`ok      ${result.name}: ${result.url}`)
  } else if (result.status === 'expired') {
    console.error(`expired ${result.name}: ${result.detail} for ${result.url}`)
  } else {
    console.warn(`skip    ${result.name}: ${result.detail}; could not verify ${result.url}`)
  }
}

function warnOrFail(strict: boolean, message: string): void {
  if (strict) console.error(`fail    ${message}`)
  else console.warn(`warning ${message}`)
}

function previewTagTime(tag: string): number {
  let match = /^v0\.(\d{8})\.(\d{1,6})-/.exec(tag)
  return match ? Number(match[1]) * 1_000_000 + Number(match[2]) : 0
}

async function fetchJson(url: string): Promise<unknown> {
  let response = await fetch(url, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }
  return response.json()
}

async function fetchRelease(tag: string): Promise<PreviewRelease> {
  let value = (await fetchJson(
    `${PREVIEW_API}/releases/tags/${encodeURIComponent(tag)}`,
  )) as Partial<PreviewRelease>
  if (typeof value.tag_name !== 'string' || !Array.isArray(value.assets)) {
    throw new Error(`invalid release response for ${tag}`)
  }
  return value as PreviewRelease
}

async function fetchLatestMainRelease(): Promise<PreviewRelease | undefined> {
  let latest = (await fetchJson(`${PREVIEW_API}/releases/latest`)) as Partial<PreviewRelease>
  if (typeof latest.tag_name === 'string' && RELEASE_TAG_RE.test(latest.tag_name)) {
    return latest as PreviewRelease
  }

  let list = await fetchJson(`${PREVIEW_API}/releases?per_page=100`)
  if (!Array.isArray(list)) throw new Error('preview releases response is not an array')
  let releases = list.filter(
    (release): release is PreviewRelease =>
      typeof release === 'object' &&
      release !== null &&
      typeof (release as PreviewRelease).tag_name === 'string' &&
      RELEASE_TAG_RE.test((release as PreviewRelease).tag_name),
  )
  return releases.toSorted((a, b) => previewTagTime(b.tag_name) - previewTagTime(a.tag_name))[0]
}

async function checkReleaseWindow(tag: string, strict: boolean): Promise<boolean> {
  let latest: PreviewRelease | undefined
  try {
    latest = await fetchLatestMainRelease()
  } catch (error) {
    console.warn(
      `warning could not read the latest preview release (${networkMessage(error)}); ` +
        'skipping the freshness check',
    )
    return false
  }

  if (!latest) {
    warnOrFail(
      strict,
      'no main preview releases found in remix-run/previews; run npm run update:remix',
    )
    return strict
  }

  if (latest.tag_name !== tag) {
    warnOrFail(
      strict,
      `a newer main preview is available: ${latest.tag_name} (pinned ${tag}). ` +
        'Run: npm run update:remix',
    )
  }

  let release: PreviewRelease
  try {
    release = latest.tag_name === tag ? latest : await fetchRelease(tag)
  } catch (error) {
    warnOrFail(
      strict,
      `could not read release ${tag} (${networkMessage(error)}); it may be pruned. ` +
        'Run: npm run update:remix',
    )
    return strict
  }

  let publishedAt =
    typeof release.published_at === 'string'
      ? Date.parse(release.published_at)
      : Date.parse(release.created_at)
  if (!Number.isFinite(publishedAt)) {
    warnOrFail(
      strict,
      `${tag} has no usable publish date; cannot check the refresh window. ` +
        'Run: npm run update:remix',
    )
    return strict
  }

  let ageMs = Math.max(0, Date.now() - publishedAt)
  let ageDays = ageMs / DAY_MS
  let published = new Date(publishedAt).toISOString()

  if (ageMs > REFRESH_AFTER_DAYS * DAY_MS) {
    warnOrFail(
      strict,
      `${tag} was published ${published} (${ageDays.toFixed(1)} days ago); ` +
        `main previews are pruned after ~${RETENTION_DAYS} days. ` +
        'Run: npm run update:remix',
    )
    return strict
  }

  console.log(
    `ok      release: ${tag} published ${published} ` +
      `(${ageDays.toFixed(1)} days ago; refresh after ${REFRESH_AFTER_DAYS} days)`,
  )
  return latest.tag_name !== tag && strict
}

async function main(): Promise<void> {
  let options = parseOptions(process.argv.slice(2))
  let pins = readPins()
  let tag = pins[0]!.tag

  console.log(`Checking remix pin ${tag} (${pins.map((pin) => pin.name).join(', ')})`)

  if (!checkLock(tag, pins)) {
    console.error('')
    console.error('Remix pin check failed: package.json and pnpm-lock.yaml disagree.')
    console.error('Run: npm run update:remix')
    process.exitCode = 1
    return
  }

  let results = await Promise.all(pins.map((pin) => headPin(pin)))
  for (let result of results) printHeadResult(result)

  if (results.some((result) => result.status === 'expired')) {
    console.error('')
    console.error(`Remix pin expired: ${tag} is no longer served for one or more packages.`)
    console.error(`Main preview releases are pruned after ~${RETENTION_DAYS} days.`)
    console.error('Run: npm run update:remix')
    process.exitCode = 1
    return
  }

  let needsRefresh = await checkReleaseWindow(tag, options.strict)
  if (needsRefresh) {
    console.error('')
    console.error('Remix pin check failed under --strict; run: npm run update:remix')
    process.exitCode = 1
    return
  }

  if (results.some((result) => result.status === 'skipped')) {
    console.log('Remix pin check passed with skipped network checks.')
  } else {
    console.log(`Remix pin ${tag} OK.`)
  }
}

main().catch((error: unknown) => {
  console.error(`remix pin check failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
