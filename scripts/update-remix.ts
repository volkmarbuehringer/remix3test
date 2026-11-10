import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

// ---------------------------------------------------------------------------
// Bump the remix preview pin.
//
// Since #12174, upstream no longer pushes preview builds to a `preview/main`
// branch. Every push to `main` publishes a GitHub release in
// `remix-run/previews`, tagged `v0.<date>.<time>-main-<source-sha-8>`, with one
// tarball asset per package (`remix.tgz`, `ui.tgz`, ...). Each tarball rewrites
// its `@remix-run/*` dependencies to the same release's asset URLs, so the
// lock pins one unified build.
//
// Steps: resolve the latest main preview release -> rewrite the two tarball
// specs -> pnpm install -> verify one release in the lock -> frozen-install
// check -> repoint the vendor skill links -> typecheck/lint/format (+ full
// tests unless --no-tests).
//
// This script still recognizes the older `github:…#preview/main&path:` and
// retained `t/<source-sha>/` specs so the last old-layout pins migrate in
// place.
//
// The store and metadata cache are exported to pnpm as both npm_config_* and
// pnpm_config_* variables (pnpm 12 reads the pnpm_config_* prefix; the
// npm_config_* pair keeps older pnpm and nested installs working). A writable
// XDG_RUNTIME_DIR is exported as well, because pnpm 12 puts its
// store-operation locks there (or in /tmp) and sandboxes deny writes outside
// the workspace. The sandbox's global store is read-only. If node_modules is
// linked from another store, it is removed first so pnpm relinks instead of
// failing with ERR_PNPM_UNEXPECTED_STORE.
// ---------------------------------------------------------------------------

const ROOT = path.resolve(import.meta.dirname, '..')
const REMOTE = 'https://github.com/remix-run/remix.git'
const MAIN_REF = 'refs/heads/main'
const PREVIEW_REPOSITORY = 'remix-run/previews'
const PREVIEW_API = `https://api.github.com/repos/${PREVIEW_REPOSITORY}`
const LOCK_PATH = path.join(ROOT, 'pnpm-lock.yaml')
const PACKAGE_PATH = path.join(ROOT, 'package.json')
const DEFAULT_STORE = path.join(ROOT, '.pnpm-store')
// pnpm 12 removed the dedicated --fetch-retries/--fetch-retry-*-timeout CLI
// flags (the installer rejects them as unknown arguments). The universal
// --config.<key> form sets the same settings on pnpm 11 and 12.
const NETWORK_FLAGS = [
  '--prefer-offline',
  '--network-concurrency=1',
  '--config.fetch-retries=10',
  '--config.fetch-retry-mintimeout=2000',
  '--config.fetch-retry-maxtimeout=60000',
]
const SOURCE_SHA_RE = /^[0-9a-f]{40}$/
const RELEASE_TAG_RE = /^v0\.\d{8}\.\d{1,6}-main-([0-9a-f]{8})$/
const STORE_VERSION_SEGMENT = /\/v\d+$/

// The two direct dependencies on the preview build. The tarball file names are
// derived from the package directory names, not the scoped package names.
const PINNED_PACKAGES = ['remix', '@remix-run/ui'] as const
const TARBALL_FILES: Record<(typeof PINNED_PACKAGES)[number], string> = {
  remix: 'remix',
  '@remix-run/ui': 'ui',
}
const OLD_SPEC_RE = /^github:remix-run\/remix#preview\/main&path:packages\/([^#&]+)$/
const LEGACY_TARBALL_SPEC_RE =
  /^https:\/\/raw\.githubusercontent\.com\/remix-run\/remix\/preview\/main\/t\/([0-9a-f]{8})\/([^/]+)\.tgz$/
const RELEASE_SPEC_RE =
  /^https:\/\/github\.com\/remix-run\/previews\/releases\/download\/(v0\.\d{8}\.\d{1,6}-main-([0-9a-f]{8}))\/([^/]+)\.tgz$/

// pnpm runs a nested `pnpm install` to prepare a git-hosted package. That child
// does not inherit --store-dir/--cache-dir flags, only the environment, so set
// the npm_config_* equivalents for every pnpm invocation. Tarball installs do
// not prepare anything, but keeping the environment makes the script safe for
// the final old-layout migration too.
let pnpmEnv: NodeJS.ProcessEnv = process.env

function environmentForStore(storeDir: string | undefined): NodeJS.ProcessEnv {
  if (!storeDir) return process.env
  let cacheDir = path.join(storeDir, 'cache')
  return {
    ...process.env,
    npm_config_store_dir: storeDir,
    npm_config_cache_dir: cacheDir,
    pnpm_config_store_dir: storeDir,
    pnpm_config_cache_dir: cacheDir,
    XDG_RUNTIME_DIR: runtimeDir(cacheDir),
  }
}

// pnpm 12 keeps store-operation locks in $XDG_RUNTIME_DIR when it is a
// user-only directory, and in /tmp otherwise. Sandboxes deny writes outside the
// workspace (including /tmp and /run/user), so point pnpm at a runtime dir next
// to the workspace store rather than inheriting the ambient variable.
function runtimeDir(cacheDir: string): string {
  let dir = path.join(cacheDir, 'runtime')
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  fs.chmodSync(dir, 0o700)
  return dir
}

type Options = {
  dryRun: boolean
  noTests: boolean
  allowDirty: boolean
  storeDir: string | undefined
}

type CommitInfo = {
  sha: string
  message: string
  parents: string[]
}

type LockState = {
  branchRefs: number
  legacyTarballRefs: number
  releaseRefs: number
  branchBuilds: string[]
  legacyTarballPrefixes: string[]
  releaseTags: string[]
}

type Pin = {
  kind: 'branch' | 'tarball' | 'release'
  build: string
  source: string | undefined
  tag: string | undefined
}

type ReleaseAsset = {
  name: string
  browser_download_url: string
}

type PreviewRelease = {
  tag_name: string
  name: string
  body: string
  draft: boolean
  created_at: string
  published_at: string | null
  assets: ReleaseAsset[]
}

function usage(): void {
  console.log(`Usage: npm run update:remix -- [options]

Resolve the latest main preview release in github.com/remix-run/previews,
rewrite the remix and @remix-run/ui tarball specs, run the install, verify the
lock has one unified release, repoint the vendor skill links, then run
typecheck, lint, format and (by default) the full test suite.

Options:
  --dry-run           Resolve and print the target release/commits; change nothing
  --no-tests          Skip the full \`npm test\` run
  --allow-dirty       Allow an uncommitted working tree
  --store-dir <dir>   pnpm store (default: ./.pnpm-store when it exists)
  -h, --help          Show this help

The package.json specs point at the release's tarball assets; the lockfile pins
their integrity and the transitive build. Old
github:…#preview/main&path: and retained t/<sha>/ specs are migrated on the
first run. The store and cache are passed to pnpm as npm_config_* variables.
`)
}

function parseOptions(argv: string[]): Options {
  let options: Options = {
    dryRun: false,
    noTests: false,
    allowDirty: false,
    storeDir: fs.existsSync(DEFAULT_STORE) ? DEFAULT_STORE : undefined,
  }

  for (let i = 0; i < argv.length; i++) {
    let arg = argv[i]
    if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--no-tests') options.noTests = true
    else if (arg === '--allow-dirty') options.allowDirty = true
    else if (arg === '--store-dir') {
      let value = argv[++i]
      if (!value) throw new Error('--store-dir needs a path')
      options.storeDir = path.resolve(ROOT, value)
    } else if (arg === '-h' || arg === '--help') {
      usage()
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${arg} (try --help)`)
    }
  }

  return options
}

function run(command: string, args: string[], capture = false): string {
  let result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
    env: command === 'pnpm' ? pnpmEnv : process.env,
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited ${result.status ?? 'without a status'}`)
  }
  return capture ? (result.stdout ?? '').trim() : ''
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function readLockState(): LockState {
  let lock = fs.readFileSync(LOCK_PATH, 'utf8')
  let branchRefs = [
    ...lock.matchAll(/codeload\.github\.com\/remix-run\/remix\/tar\.gz\/([0-9a-f]{40})/g),
  ]
    .map((match) => match[1])
    .filter((ref): ref is string => Boolean(ref))
  let legacyTarballRefs = [
    ...lock.matchAll(
      /raw\.githubusercontent\.com\/remix-run\/remix\/preview\/main\/t\/([0-9a-f]{8})\//g,
    ),
  ]
    .map((match) => match[1])
    .filter((prefix): prefix is string => Boolean(prefix))
  let releaseRefs = [
    ...lock.matchAll(/github\.com\/remix-run\/previews\/releases\/download\/([^/]+)\//g),
  ]
    .map((match) => match[1])
    .filter((tag): tag is string => Boolean(tag))
  return {
    branchRefs: branchRefs.length,
    legacyTarballRefs: legacyTarballRefs.length,
    releaseRefs: releaseRefs.length,
    branchBuilds: unique(branchRefs),
    legacyTarballPrefixes: unique(legacyTarballRefs),
    releaseTags: unique(releaseRefs),
  }
}

function readDependencies(): Record<string, string> {
  return JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8')).dependencies ?? {}
}

/**
 * Returns the current spec style, or throws when package.json is not on one of
 * the three preview layouts. The older styles are accepted so the final
 * old-layout pins migrate in place.
 */
function currentSpecKind(): Pin['kind'] {
  let dependencies = readDependencies()
  let kinds = new Set<Pin['kind']>()

  for (let name of PINNED_PACKAGES) {
    let spec = dependencies[name]
    if (!spec) throw new Error(`${name} is missing from package.json dependencies`)

    let oldMatch = OLD_SPEC_RE.exec(spec)
    if (oldMatch) {
      if (oldMatch[1] !== TARBALL_FILES[name]) {
        throw new Error(`${name} points at an unexpected package path: ${spec}`)
      }
      kinds.add('branch')
      continue
    }

    let legacyMatch = LEGACY_TARBALL_SPEC_RE.exec(spec)
    if (legacyMatch) {
      if (legacyMatch[2] !== TARBALL_FILES[name]) {
        throw new Error(`${name} points at an unexpected tarball name: ${spec}`)
      }
      kinds.add('tarball')
      continue
    }

    let releaseMatch = RELEASE_SPEC_RE.exec(spec)
    if (releaseMatch) {
      if (releaseMatch[3] !== TARBALL_FILES[name]) {
        throw new Error(`${name} points at an unexpected release asset: ${spec}`)
      }
      kinds.add('release')
      continue
    }

    throw new Error(
      `${name} is not a supported remix preview spec (got ${spec}). ` +
        `Expected a github:…#preview/main&path: spec, a t/<8-hex>/ tarball URL, ` +
        `or a remix-run/previews release asset URL.`,
    )
  }

  if (kinds.size !== 1) {
    throw new Error(
      'remix and @remix-run/ui use different preview spec styles; update them together',
    )
  }
  return [...kinds][0]!
}

async function readCurrentPin(kind: Pin['kind'], before: LockState): Promise<Pin> {
  if (kind === 'branch') {
    // A mixed old lock is fine for the migration: the tarball install replaces
    // every codeload ref. Use the first build only to report and compare.
    let build = before.branchBuilds[0]
    if (before.branchBuilds.length > 1) {
      console.log(
        `Note: old lock has ${before.branchBuilds.length} git-hosted builds ` +
          `(${before.branchBuilds.map(short).join(', ')}); migrating all of them.`,
      )
    }
    let info = build && SOURCE_SHA_RE.test(build) ? await githubCommit(build) : undefined
    return { kind, build: build ?? 'unknown', source: info?.parents[0], tag: undefined }
  }

  let dependencies = readDependencies()

  if (kind === 'tarball') {
    let prefixes = new Set(
      PINNED_PACKAGES.map((name) => {
        let match = LEGACY_TARBALL_SPEC_RE.exec(dependencies[name] ?? '')
        return match?.[1]
      }),
    )
    let prefix = [...prefixes][0]
    if (!prefix || prefixes.size !== 1) {
      throw new Error('Could not determine the current retained tarball build from package.json')
    }
    let info = await githubCommit(prefix)
    return { kind, build: prefix, source: info?.sha, tag: undefined }
  }

  let tags = new Set(
    PINNED_PACKAGES.map((name) => {
      let match = RELEASE_SPEC_RE.exec(dependencies[name] ?? '')
      return match?.[1]
    }),
  )
  let tag = [...tags][0]
  if (!tag || tags.size !== 1) {
    throw new Error('Could not determine the current preview release from package.json')
  }
  let sha = RELEASE_TAG_RE.exec(tag)?.[1]
  if (!sha) throw new Error(`Invalid preview release tag in package.json: ${tag}`)
  let info = await githubCommit(sha)
  return { kind, build: tag, source: info?.sha, tag }
}

function versionAt(...segments: string[]): string | undefined {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, ...segments), 'utf8')).version
  } catch {
    return undefined
  }
}

// Read transitive packages through the public-hoisted store links: pnpm
// truncates the build URL inside `.pnpm` directory names to different lengths
// per package, so scanning dir names for the release tag is not reliable.
function installedVersions(): string {
  let versions = [
    ['remix', versionAt('node_modules/remix/package.json')],
    ['@remix-run/ui', versionAt('node_modules/@remix-run/ui/package.json')],
    ['component', versionAt('node_modules/.pnpm/node_modules/@remix-run/component/package.json')],
    [
      'component-hmr',
      versionAt('node_modules/.pnpm/node_modules/@remix-run/component-hmr/package.json'),
    ],
  ]
  return versions
    .filter(([, version]) => version)
    .map(([name, version]) => `${name} ${version}`)
    .join(', ')
}

function githubHeaders(): Record<string, string> {
  let headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'remix3test-update-remix',
  }
  let token = process.env.GITHUB_TOKEN?.trim()
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

async function githubCommit(sha: string): Promise<CommitInfo | undefined> {
  try {
    let response = await fetch(`https://api.github.com/repos/remix-run/remix/commits/${sha}`, {
      headers: githubHeaders(),
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) return undefined
    let json = (await response.json()) as {
      sha?: string
      commit?: { message?: string }
      parents?: Array<{ sha?: string }>
    }
    return {
      sha: json.sha ?? sha,
      message: json.commit?.message ?? '',
      parents: (json.parents ?? []).map((parent) => parent.sha ?? '').filter(Boolean),
    }
  } catch {
    return undefined
  }
}

async function compareCommits(base: string, head: string): Promise<string[] | undefined> {
  try {
    let response = await fetch(
      `https://api.github.com/repos/remix-run/remix/compare/${base}...${head}`,
      {
        headers: githubHeaders(),
        signal: AbortSignal.timeout(10_000),
      },
    )
    if (!response.ok) return undefined
    let json = (await response.json()) as {
      commits?: Array<{ commit?: { message?: string } }>
    }
    return (json.commits ?? [])
      .map((entry) => (entry.commit?.message ?? '').split('\n')[0] ?? '')
      .filter((subject) => subject.length > 0)
  } catch {
    return undefined
  }
}

function short(sha: string): string {
  return sha.slice(0, 10)
}

function previewTagTime(tag: string): number {
  let match = /^v0\.(\d{8})\.(\d{1,6})-/.exec(tag)
  return match ? Number(match[1]) * 1_000_000 + Number(match[2]) : 0
}

async function fetchJson(url: string): Promise<unknown> {
  let response = await fetch(url, {
    headers: githubHeaders(),
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) {
    throw new Error(`Could not read ${url} (HTTP ${response.status})`)
  }
  return response.json()
}

async function listMainReleases(): Promise<PreviewRelease[]> {
  let value = await fetchJson(`${PREVIEW_API}/releases?per_page=100`)
  if (!Array.isArray(value)) throw new Error('Preview releases response is not an array')
  return value.filter(
    (release): release is PreviewRelease =>
      typeof release === 'object' &&
      release !== null &&
      typeof (release as PreviewRelease).tag_name === 'string' &&
      RELEASE_TAG_RE.test((release as PreviewRelease).tag_name),
  )
}

/**
 * The "latest" release is the newest main build; PR previews are prereleases,
 * so they are not selected. Fall back to scanning the release list if upstream
 * ever marks a main build differently.
 */
async function fetchLatestMainRelease(): Promise<PreviewRelease> {
  let latest = (await fetchJson(`${PREVIEW_API}/releases/latest`)) as Partial<PreviewRelease>
  if (typeof latest.tag_name === 'string' && RELEASE_TAG_RE.test(latest.tag_name)) {
    return validateRelease(latest as PreviewRelease)
  }

  let releases = await listMainReleases()
  let newest = releases.toSorted(
    (a, b) => previewTagTime(b.tag_name) - previewTagTime(a.tag_name),
  )[0]
  if (!newest) throw new Error('No main preview releases found in remix-run/previews')
  return validateRelease(newest)
}

function validateRelease(release: PreviewRelease): PreviewRelease {
  let tag = release.tag_name
  if (release.draft)
    throw new Error(`Preview release ${tag} is still a draft; wait for it to publish`)
  if (!Array.isArray(release.assets)) throw new Error(`Preview release ${tag} has no assets`)

  let sha = RELEASE_TAG_RE.exec(tag)?.[1]
  if (!sha) throw new Error(`Unexpected preview release tag: ${tag}`)

  for (let name of PINNED_PACKAGES) {
    let file = TARBALL_FILES[name]
    let asset = release.assets.find((candidate) => candidate.name === `${file}.tgz`)
    if (!asset) throw new Error(`Preview release ${tag} is missing ${file}.tgz`)
    let match = RELEASE_SPEC_RE.exec(asset.browser_download_url)
    if (!match) throw new Error(`Unexpected ${name} asset URL: ${asset.browser_download_url}`)
    if (match[1] !== tag || match[2] !== sha || match[3] !== file) {
      throw new Error(`${name} asset URL does not belong to ${tag}: ${asset.browser_download_url}`)
    }
  }

  return release
}

function releaseUrl(release: PreviewRelease, name: (typeof PINNED_PACKAGES)[number]): string {
  let file = TARBALL_FILES[name]
  let asset = release.assets.find((candidate) => candidate.name === `${file}.tgz`)
  if (!asset) throw new Error(`Preview release ${release.tag_name} is missing ${file}.tgz`)
  return asset.browser_download_url
}

function rewritePackageJson(release: PreviewRelease): boolean {
  let text = fs.readFileSync(PACKAGE_PATH, 'utf8')
  let next = text

  for (let name of PINNED_PACKAGES) {
    let url = releaseUrl(release, name)
    let pattern = new RegExp(`("${escapeRegExp(name)}":\\s*)"[^"]*"`)
    if (!pattern.test(next)) throw new Error(`Could not find the ${name} spec in package.json`)
    next = next.replace(pattern, (_match, prefix: string) => `${prefix}${JSON.stringify(url)}`)
  }

  if (next === text) return false
  fs.writeFileSync(PACKAGE_PATH, next)
  return true
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function assertLockAt(tag: string, release: PreviewRelease): void {
  let after = readLockState()
  if (after.branchBuilds.length > 0) {
    throw new Error(
      `Lock still contains git-hosted remix refs: ` +
        `${after.branchBuilds.map(short).join(', ')} (${after.branchRefs} refs).`,
    )
  }
  if (after.legacyTarballPrefixes.length > 0) {
    throw new Error(
      `Lock still contains retained preview tarball refs: ` +
        `${after.legacyTarballPrefixes.map((prefix) => `t/${prefix}`).join(', ')} ` +
        `(${after.legacyTarballRefs} refs).`,
    )
  }
  if (after.releaseTags.length !== 1 || after.releaseTags[0] !== tag) {
    throw new Error(
      `Lock is not unified at ${tag}: ` +
        `${after.releaseTags.join(', ') || 'none'} (${after.releaseRefs} refs). ` +
        'The preview release may have moved during the update; review and rerun.',
    )
  }

  let lock = fs.readFileSync(LOCK_PATH, 'utf8')
  for (let name of PINNED_PACKAGES) {
    let url = releaseUrl(release, name)
    if (!lock.includes(url)) throw new Error(`Lock does not reference the ${name} tarball: ${url}`)
  }

  console.log(`Lock unified: ${after.releaseRefs} release tarball refs at ${tag}`)
}

function assertOnlyPinLinesChanged(): void {
  let diff = run('git', ['diff', '--', 'package.json'], true)
  let unexpected = diff
    .split('\n')
    .filter((line) => /^[+-][^+-]/.test(line))
    .filter((line) => !line.includes('"remix":') && !line.includes('"@remix-run/ui":'))
  if (unexpected.length > 0) {
    console.error('\nWARNING: package.json changed beyond the two pin lines:')
    for (let line of unexpected) console.error(line)
    console.error('Review the change and complete the lock or revert it.')
    process.exitCode = 1
  }
}

function linkedStore(): string | undefined {
  try {
    let modules = fs.readFileSync(path.join(ROOT, 'node_modules/.modules.yaml'), 'utf8')
    return /"?storeDir"?\s*:\s*"([^"]+)"/.exec(modules)?.[1]
  } catch {
    return undefined
  }
}

// pnpm refuses to reuse a node_modules tree linked from another store
// (ERR_PNPM_UNEXPECTED_STORE), and a plain `pnpm install` will not relink it
// while node_modules/.pnpm/lock.yaml matches. Only removing the tree makes the
// next install relink; the packages themselves stay in the store.
function relinkIntoStore(storeDir: string | undefined, dryRun: boolean): void {
  if (!storeDir) return
  let linked = linkedStore()
  if (!linked) return

  let store = path.resolve(storeDir).replace(STORE_VERSION_SEGMENT, '')
  if (path.resolve(linked).replace(STORE_VERSION_SEGMENT, '') === store) return

  console.log(`Store mismatch: node_modules is linked from ${linked}, not ${storeDir}.`)
  if (dryRun) {
    console.log('Dry run: would remove node_modules so pnpm relinks into that store.')
    return
  }
  console.log('Removing node_modules so pnpm relinks into that store (packages stay in the store).')
  fs.rmSync(path.join(ROOT, 'node_modules'), { recursive: true, force: true })
}

function findCliInstall(tag: string): string {
  let hoisted = path.join(ROOT, 'node_modules/.pnpm/node_modules/@remix-run/cli')
  if (fs.existsSync(path.join(hoisted, 'template/.agents/skills/remix/SKILL.md'))) {
    return hoisted
  }

  // Fallback for layouts without public hoisting. Directory names truncate the
  // release URL at different lengths, so compare a short tag prefix.
  let virtual = path.join(ROOT, 'node_modules/.pnpm')
  let tagKey = tag.slice(0, 24)
  let entries = fs.readdirSync(virtual).filter((entry) => entry.startsWith('@remix-run+cli@'))
  let candidates = [
    ...entries.filter((entry) => entry.includes(tagKey)),
    ...entries.filter((entry) => !entry.includes(tagKey)),
  ]
  for (let cliDir of candidates) {
    let pkg = path.join(virtual, cliDir, 'node_modules/@remix-run/cli')
    if (fs.existsSync(path.join(pkg, 'template/.agents/skills/remix/SKILL.md'))) return pkg
  }
  throw new Error(`No @remix-run/cli install found for ${tag}`)
}

function repointSkillLinks(tag: string): void {
  let source = path.join(findCliInstall(tag), 'template/.agents/skills/remix')
  let links = [path.join(ROOT, '.agents/skills/remix'), path.join(ROOT, '.opencode/skills/remix')]

  for (let link of links) {
    let relativeTarget = path.relative(path.dirname(link), source)
    let currentTarget = fs.existsSync(link) ? fs.readlinkSync(link) : undefined
    if (currentTarget === relativeTarget) {
      console.log(`${path.relative(ROOT, link)} already points at the new CLI template`)
      continue
    }

    fs.rmSync(link, { force: true })
    fs.symlinkSync(relativeTarget, link)
    console.log(`Repointed ${path.relative(ROOT, link)} -> ${relativeTarget}`)
  }
}

async function main(): Promise<void> {
  let options = parseOptions(process.argv.slice(2))
  pnpmEnv = environmentForStore(options.storeDir)
  let specKind = currentSpecKind()

  if (!options.dryRun && !options.allowDirty) {
    let dirty = run('git', ['status', '--porcelain'], true)
    if (dirty) {
      throw new Error(
        `Working tree is not clean:\n${dirty}\nCommit/stash first, or pass --allow-dirty.`,
      )
    }
  }

  let before = readLockState()
  let oldPin = await readCurrentPin(specKind, before)

  let release = await fetchLatestMainRelease()
  let targetTag = release.tag_name
  let targetSha = RELEASE_TAG_RE.exec(targetTag)?.[1] ?? ''
  let targetSource = (await githubCommit(targetSha))?.sha ?? targetSha

  let mainTip = run('git', ['ls-remote', REMOTE, MAIN_REF], true).split(/\s+/)[0] ?? ''
  if (SOURCE_SHA_RE.test(mainTip) && !mainTip.startsWith(targetSha)) {
    console.log(
      `Note: main is at ${short(mainTip)} but the latest published preview is ${targetSha}; ` +
        'the Preview Build workflow has not published that commit yet.',
    )
  }

  console.log('== Remix pin update ==')
  console.log(
    `Current pin: ${oldPin.kind === 'release' ? oldPin.build : short(oldPin.build)}` +
      `${oldPin.source ? ` (source ${short(oldPin.source)})` : ''} [${oldPin.kind}]`,
  )
  console.log(`Target pin:  ${targetTag} (source ${short(targetSource)})`)
  console.log(`Before:      ${installedVersions()}`)
  console.log(
    `Target:      ${PINNED_PACKAGES.map((name) => releaseUrl(release, name)).join('\n             ')}`,
  )

  if (oldPin.source && oldPin.source !== targetSource) {
    let subjects = await compareCommits(oldPin.source, targetSource)
    if (subjects?.length) {
      console.log('Commits:')
      for (let subject of subjects) console.log(`  - ${subject}`)
    }
  }

  let lockAtTarget =
    before.branchBuilds.length === 0 &&
    before.legacyTarballPrefixes.length === 0 &&
    before.releaseTags.length === 1 &&
    before.releaseTags[0] === targetTag
  if (oldPin.kind === 'release' && oldPin.tag === targetTag && lockAtTarget) {
    if (!options.dryRun) repointSkillLinks(targetTag)
    console.log('\nAlready up to date; nothing to do.')
    return
  }

  if (options.dryRun) {
    relinkIntoStore(options.storeDir, true)
    console.log('\nDry run: would rewrite the two tarball specs and run pnpm install.')
    return
  }

  console.log('\n== Installing ==')
  relinkIntoStore(options.storeDir, false)
  let rewritten = rewritePackageJson(release)
  if (rewritten) console.log('Updated package.json tarball specs')
  let storeFlags = options.storeDir ? ['--store-dir', options.storeDir] : []
  run('pnpm', ['install', '--no-frozen-lockfile', ...NETWORK_FLAGS, ...storeFlags])

  assertLockAt(targetTag, release)
  assertOnlyPinLinesChanged()

  console.log('\n== Frozen install check ==')
  run('pnpm', ['install', '--frozen-lockfile', ...NETWORK_FLAGS, ...storeFlags])

  console.log('\n== Vendor skill symlink ==')
  repointSkillLinks(targetTag)

  console.log(`\nVersions: ${installedVersions()}`)

  console.log('\n== Checks ==')
  run('npm', ['run', 'typecheck'])
  run('npm', ['run', 'lint'])
  run('npm', ['run', 'format'])
  if (options.noTests) {
    console.log('Tests skipped (--no-tests).')
  } else {
    run('npm', ['test'])
  }

  console.log('\n== Done ==')
  console.log(`Release: ${targetTag}`)
  console.log(`Source:  ${targetSource} (main ${short(mainTip)})`)
  console.log('Record the bump in:')
  console.log('  - AGENTS.md (installed build/source)')
  console.log('  - docs/remix-pin-history.md')
  console.log('  - docs/guide-skill-coverage.md (anchor)')
  console.log(
    '  - .opencode/skills/learned/remix3-tooling/references/remix3-build-and-tooling/upstream-dependency-analysis.md',
  )
  console.log(`Commit: chore(deps): bump remix preview pin to ${targetSha}`)
}

main().catch((error: unknown) => {
  console.error(`\nupdate-remix failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
