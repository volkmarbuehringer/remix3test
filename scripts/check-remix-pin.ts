import * as fs from 'node:fs'
import * as path from 'node:path'

// ---------------------------------------------------------------------------
// Check that the remix preview pin is still installable.
//
// Since #12126, preview/main carries retained tarballs under
// `t/<source-sha>/` plus a `t/preview.json` manifest listing the builds it
// still serves. Retained builds are pruned after roughly seven days, so a
// lockfile pointed at an old `t/<sha>` URL installs until it suddenly 404s.
//
// This check:
//   1. reads the two tarball URLs from package.json,
//   2. verifies pnpm-lock.yaml resolves every remix ref to that same
//      t/<8-hex> build (a half-applied update fails before any network call),
//   3. HEADs both URLs (404/410 means the pin expired),
//   4. reads t/preview.json from preview/main, finds the pinned 8-hex build,
//      and warns when it is older than the five-day refresh window.
//
// It is dependency-free and offline-safe: network/HTTP failures that are not
// the tarball's own 404 are warnings, not failures. `--strict` upgrades the
// refresh-window warnings (age, missing manifest entry) to failures.
// ---------------------------------------------------------------------------

const ROOT = path.resolve(import.meta.dirname, '..')
const PACKAGE_PATH = path.join(ROOT, 'package.json')
const LOCK_PATH = path.join(ROOT, 'pnpm-lock.yaml')
const MANIFEST_URL = 'https://raw.githubusercontent.com/remix-run/remix/preview/main/t/preview.json'
const PINNED_PACKAGES = ['remix', '@remix-run/ui'] as const
const TARBALL_FILES: Record<(typeof PINNED_PACKAGES)[number], string> = {
  remix: 'remix',
  '@remix-run/ui': 'ui',
}
const TARBALL_SPEC_RE =
  /^(https:\/\/raw\.githubusercontent\.com\/remix-run\/remix\/preview\/main\/t\/([0-9a-f]{8})\/([^/]+)\.tgz)$/
const LOCK_TARBALL_REF_RE =
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

type TarballPin = {
  name: (typeof PINNED_PACKAGES)[number]
  url: string
  prefix: string
}

type HeadResult = {
  name: string
  url: string
  status: 'ok' | 'expired' | 'skipped'
  detail: string
}

type ManifestBuild = {
  sha?: string
  createdAt?: string
}

type PreviewManifest = {
  branch?: string
  builds?: ManifestBuild[]
}

type LockPackageRef = {
  name: string
  version: string
}

type LockState = {
  tarballRefs: number
  prefixes: string[]
  codeloadRefs: number
  codeloadBuilds: string[]
  packageRefs: LockPackageRef[]
}

function usage(): void {
  console.log(`Usage: npm run remix:pin:check -- [options]

Verify the remix preview tarballs pinned in package.json still exist and are
inside the five-day refresh window. Also verifies pnpm-lock.yaml resolves every
remix ref to the same build. Exits nonzero on lock drift or when the pin has
expired (HTTP 404/410) so CI catches it before an install fails.

Options:
  --strict   Fail on refresh-window warnings (build older than 5 days or no
             longer listed in preview/main's builds[]), not just on 404s
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

function readPins(): TarballPin[] {
  let packageJson = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8')) as {
    dependencies?: Record<string, string>
  }
  let pins: TarballPin[] = []

  for (let name of PINNED_PACKAGES) {
    let spec = packageJson.dependencies?.[name]
    if (!spec) throw new Error(`${name} is missing from package.json dependencies`)

    let match = TARBALL_SPEC_RE.exec(spec)
    if (!match) {
      throw new Error(
        `${name} is not pinned to a retained preview tarball (got ${spec}). ` +
          'Expected https://raw.githubusercontent.com/…/t/<8-hex>/<pkg>.tgz; ' +
          'run npm run update:remix.',
      )
    }

    let prefix = match[2]
    let file = match[3]
    if (!prefix || file !== TARBALL_FILES[name]) {
      throw new Error(`${name} points at an unexpected tarball: ${spec}`)
    }
    pins.push({ name, url: spec, prefix })
  }

  let prefixes = [...new Set(pins.map((pin) => pin.prefix))]
  if (prefixes.length !== 1) {
    throw new Error(
      `remix and @remix-run/ui point at different builds (${prefixes.join(', ')}); ` +
        'update them together.',
    )
  }

  return pins
}

function short(value: string): string {
  return value.slice(0, 10)
}

function readLockState(lock: string): LockState {
  let tarballPrefixes = [...lock.matchAll(LOCK_TARBALL_REF_RE)]
    .map((match) => match[1])
    .filter((prefix): prefix is string => Boolean(prefix))
  let codeloadBuilds = [...lock.matchAll(LOCK_CODELOAD_REF_RE)]
    .map((match) => match[1])
    .filter((build): build is string => Boolean(build))
  let packageRefs = [...lock.matchAll(LOCK_PACKAGE_KEY_RE)]
    .map((match) => ({ name: match[1] ?? '', version: match[2] ?? '' }))
    .filter((ref) => ref.name.length > 0 && ref.version.length > 0)

  return {
    tarballRefs: tarballPrefixes.length,
    prefixes: [...new Set(tarballPrefixes)],
    codeloadRefs: codeloadBuilds.length,
    codeloadBuilds: [...new Set(codeloadBuilds)],
    packageRefs,
  }
}

/**
 * A half-applied update can leave package.json on one build while the lock
 * still carries the old build (or a mix of tarball and codeload refs). Catch
 * that locally and before `pnpm install`, so the fix is always the same
 * `update:remix` run instead of an opaque resolution failure.
 */
function checkLock(prefix: string, pins: TarballPin[]): boolean {
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
  if (state.tarballRefs === 0) {
    problems.push('pnpm-lock.yaml has no retained preview tarball refs; run npm run update:remix')
  } else if (state.prefixes.length !== 1 || state.prefixes[0] !== prefix) {
    problems.push(
      `pnpm-lock.yaml tarball refs span ` +
        `${state.prefixes.map((value) => `t/${value}`).join(', ')} ` +
        `(${state.tarballRefs} refs); expected t/${prefix}. Run npm run update:remix`,
    )
  }

  let expectedPrefix = `https://raw.githubusercontent.com/remix-run/remix/preview/main/t/${prefix}/`
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
        `outside t/${prefix} (${examples}${packageRefsOutsidePin.length > 3 ? ', …' : ''}); ` +
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

  console.log(`ok      lock: ${state.tarballRefs} tarball refs at t/${prefix}, no codeload refs`)
  return true
}

function networkMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'TimeoutError') return 'timed out'
    return error.message
  }
  return String(error)
}

async function headPin(pin: TarballPin): Promise<HeadResult> {
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

async function checkManifest(prefix: string, strict: boolean): Promise<boolean> {
  let manifest: PreviewManifest

  try {
    let response = await fetch(MANIFEST_URL, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!response.ok) {
      console.warn(
        `warning preview manifest returned HTTP ${response.status}; skipping the age check`,
      )
      return false
    }
    manifest = (await response.json()) as PreviewManifest
  } catch (error) {
    console.warn(
      `warning could not read the preview manifest (${networkMessage(error)}); ` +
        'skipping the age check',
    )
    return false
  }

  if (manifest.branch !== 'preview/main') {
    console.warn(
      `warning preview manifest reports branch ${manifest.branch ?? 'missing'}; ` +
        'skipping the age check',
    )
    return false
  }

  let builds = Array.isArray(manifest.builds) ? manifest.builds : []
  let build = builds.find((entry) => typeof entry.sha === 'string' && entry.sha.startsWith(prefix))
  if (!build) {
    warnOrFail(
      strict,
      `t/${prefix} is not listed in preview/main builds[]; it may be pruned soon. ` +
        'Run: npm run update:remix',
    )
    return strict
  }

  let createdAt = typeof build.createdAt === 'string' ? Date.parse(build.createdAt) : Number.NaN
  if (!Number.isFinite(createdAt)) {
    warnOrFail(
      strict,
      `t/${prefix} has no usable createdAt in the preview manifest; ` +
        'cannot check the refresh window. Run: npm run update:remix',
    )
    return strict
  }

  let ageMs = Math.max(0, Date.now() - createdAt)
  let ageDays = ageMs / DAY_MS
  let created = new Date(createdAt).toISOString()

  if (ageMs > REFRESH_AFTER_DAYS * DAY_MS) {
    warnOrFail(
      strict,
      `t/${prefix} was created ${created} (${ageDays.toFixed(1)} days ago); ` +
        `retained builds are pruned after ~${RETENTION_DAYS} days. ` +
        'Run: npm run update:remix',
    )
    return strict
  }

  console.log(
    `ok      manifest: t/${prefix} created ${created} ` +
      `(${ageDays.toFixed(1)} days ago; refresh after ${REFRESH_AFTER_DAYS} days)`,
  )
  return false
}

async function main(): Promise<void> {
  let options = parseOptions(process.argv.slice(2))
  let pins = readPins()
  let prefix = pins[0]!.prefix

  console.log(`Checking remix pin t/${prefix} (${pins.map((pin) => pin.name).join(', ')})`)

  if (!checkLock(prefix, pins)) {
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
    console.error(`Remix pin expired: t/${prefix} is no longer served for one or more packages.`)
    console.error(`Retained preview builds are pruned after ~${RETENTION_DAYS} days.`)
    console.error('Run: npm run update:remix')
    process.exitCode = 1
    return
  }

  let needsRefresh = await checkManifest(prefix, options.strict)
  if (needsRefresh) {
    console.error('')
    console.error('Remix pin check failed under --strict; run: npm run update:remix')
    process.exitCode = 1
    return
  }

  if (results.some((result) => result.status === 'skipped')) {
    console.log('Remix pin check passed with skipped network checks.')
  } else {
    console.log(`Remix pin t/${prefix} OK.`)
  }
}

main().catch((error: unknown) => {
  console.error(`remix pin check failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
