import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

// ---------------------------------------------------------------------------
// Bump the remix preview pin.
//
// Since #12126, upstream's `preview/main` branch no longer commits built
// `packages/*` trees. Every build commit carries retained tarballs under
// `t/<source-sha>/` plus a `t/preview.json` manifest, and package.json points
// at the manifest's tarball URLs for `remix` and `@remix-run/ui`. The lockfile
// pins the tarball integrity and the transitive `@remix-run/*` tarball URLs,
// which all point at the same source build.
//
// Steps: resolve preview/main -> read t/preview.json from that build commit ->
// rewrite the two tarball specs -> pnpm install -> verify one build in the
// lock -> frozen-install check -> repoint the vendor skill links ->
// typecheck/lint/format (+ full tests unless --no-tests).
//
// This script still recognizes the old `github:…#preview/main&path:` specs so
// the last old-layout pin can be migrated in place.
//
// The store and metadata cache are exported to pnpm as npm_config_* variables
// (the sandbox's global store is read-only). If node_modules is linked from
// another store, it is removed first so pnpm relinks instead of failing with
// ERR_PNPM_UNEXPECTED_STORE.
// ---------------------------------------------------------------------------

const ROOT = path.resolve(import.meta.dirname, '..')
const REMOTE = 'https://github.com/remix-run/remix.git'
const BRANCH = 'refs/heads/preview/main'
const LOCK_PATH = path.join(ROOT, 'pnpm-lock.yaml')
const PACKAGE_PATH = path.join(ROOT, 'package.json')
const DEFAULT_STORE = path.join(ROOT, '.pnpm-store')
const NETWORK_FLAGS = [
  '--prefer-offline',
  '--network-concurrency=1',
  '--fetch-retries=10',
  '--fetch-retry-mintimeout=2000',
  '--fetch-retry-maxtimeout=60000',
]
const SOURCE_SHA_RE = /^[0-9a-f]{40}$/
const STORE_VERSION_SEGMENT = /\/v\d+$/

// The two direct dependencies on the preview build. The tarball file names are
// derived from the package directory names, not the scoped package names.
const PINNED_PACKAGES = ['remix', '@remix-run/ui'] as const
const TARBALL_FILES: Record<(typeof PINNED_PACKAGES)[number], string> = {
  remix: 'remix',
  '@remix-run/ui': 'ui',
}
const OLD_SPEC_RE = /^github:remix-run\/remix#preview\/main&path:packages\/([^#&]+)$/
const TARBALL_SPEC_RE =
  /^https:\/\/raw\.githubusercontent\.com\/remix-run\/remix\/preview\/main\/t\/([0-9a-f]{8})\/([^/]+)\.tgz$/

// pnpm runs a nested `pnpm install` to prepare a git-hosted package. That child
// does not inherit --store-dir/--cache-dir flags, only the environment, so set
// the npm_config_* equivalents for every pnpm invocation. Tarball installs do
// not prepare anything, but keeping the environment makes the script safe for
// the final old-layout migration too.
let pnpmEnv: NodeJS.ProcessEnv = process.env

function environmentForStore(storeDir: string | undefined): NodeJS.ProcessEnv {
  if (!storeDir) return process.env
  return {
    ...process.env,
    npm_config_store_dir: storeDir,
    npm_config_cache_dir: path.join(storeDir, 'cache'),
  }
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
  tarballRefs: number
  branchBuilds: string[]
  tarballPrefixes: string[]
}

type Pin = {
  kind: 'branch' | 'tarball'
  build: string
  source: string | undefined
}

type PreviewManifest = {
  branch: string
  sha: string
  packages: Record<string, string>
}

function usage(): void {
  console.log(`Usage: npm run update:remix -- [options]

Resolve github.com/remix-run/remix preview/main, read its t/preview.json
manifest, rewrite the remix and @remix-run/ui tarball specs, run the install,
verify the lock has one unified build, repoint the vendor skill links, then run
typecheck, lint, format and (by default) the full test suite.

Options:
  --dry-run           Resolve and print the target build/commits; change nothing
  --no-tests          Skip the full \`npm test\` run
  --allow-dirty       Allow an uncommitted working tree
  --store-dir <dir>   pnpm store (default: ./.pnpm-store when it exists)
  -h, --help          Show this help

The package.json specs point at the preview manifest's tarball URLs; the
lockfile pins their integrity and the transitive build. Old
github:…#preview/main&path: specs are migrated on the first run. The store and
cache are passed to pnpm as npm_config_* variables.
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
  let tarballRefs = [
    ...lock.matchAll(
      /raw\.githubusercontent\.com\/remix-run\/remix\/preview\/main\/t\/([0-9a-f]{8})\//g,
    ),
  ]
    .map((match) => match[1])
    .filter((prefix): prefix is string => Boolean(prefix))
  return {
    branchRefs: branchRefs.length,
    tarballRefs: tarballRefs.length,
    branchBuilds: unique(branchRefs),
    tarballPrefixes: unique(tarballRefs),
  }
}

function readDependencies(): Record<string, string> {
  return JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8')).dependencies ?? {}
}

/**
 * Returns the current spec style, or throws when package.json is not on one of
 * the two preview layouts. The old branch style is accepted so the final
 * old-layout pin can migrate to tarballs in place.
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

    let tarballMatch = TARBALL_SPEC_RE.exec(spec)
    if (tarballMatch) {
      if (tarballMatch[2] !== TARBALL_FILES[name]) {
        throw new Error(`${name} points at an unexpected tarball name: ${spec}`)
      }
      kinds.add('tarball')
      continue
    }

    throw new Error(
      `${name} is not a supported remix preview spec (got ${spec}). ` +
        `Expected a github:…#preview/main&path: spec or a t/<8-hex>/ tarball URL.`,
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
    return { kind, build: build ?? 'unknown', source: info?.parents[0] }
  }

  let dependencies = readDependencies()
  let prefixes = new Set(
    PINNED_PACKAGES.map((name) => {
      let match = TARBALL_SPEC_RE.exec(dependencies[name] ?? '')
      return match?.[1]
    }),
  )
  let prefix = [...prefixes][0]
  if (!prefix || prefixes.size !== 1) {
    throw new Error('Could not determine the current tarball build from package.json')
  }
  let info = await githubCommit(prefix)
  return { kind, build: prefix, source: info?.sha }
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
// per package, so scanning dir names for the build prefix is not reliable.
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

async function githubCommit(sha: string): Promise<CommitInfo | undefined> {
  try {
    let response = await fetch(`https://api.github.com/repos/remix-run/remix/commits/${sha}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'remix3test-update-remix',
      },
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
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'remix3test-update-remix',
        },
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

/**
 * Fetch the manifest from the build commit itself, not the branch tip, so a
 * branch move or raw.githubusercontent cache cannot hand us a different build
 * than the one ls-remote just resolved.
 */
async function fetchPreviewManifest(build: string): Promise<PreviewManifest> {
  let url = `https://raw.githubusercontent.com/remix-run/remix/${build}/t/preview.json`
  let response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'remix3test-update-remix',
    },
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) {
    throw new Error(
      `Could not read ${url} (HTTP ${response.status}). ` +
        'If preview/main was just updated, wait for the build to finish and rerun.',
    )
  }

  let manifest = (await response.json()) as Partial<PreviewManifest>
  if (manifest.branch !== 'preview/main') {
    throw new Error(`Unexpected preview manifest branch: ${manifest.branch ?? 'missing'}`)
  }
  if (!manifest.sha || !SOURCE_SHA_RE.test(manifest.sha)) {
    throw new Error(`Invalid preview manifest source sha: ${manifest.sha ?? 'missing'}`)
  }
  if (!manifest.packages || typeof manifest.packages !== 'object') {
    throw new Error('Preview manifest has no packages map')
  }

  let prefix = manifest.sha.slice(0, 8)
  for (let name of PINNED_PACKAGES) {
    let tarballUrl = manifest.packages[name]
    if (typeof tarballUrl !== 'string') throw new Error(`Preview manifest is missing ${name}`)
    let match = TARBALL_SPEC_RE.exec(tarballUrl)
    if (!match) throw new Error(`Unexpected ${name} tarball URL: ${tarballUrl}`)
    if (match[1] !== prefix) {
      throw new Error(`${name} URL is from t/${match[1]}, not t/${prefix}: ${tarballUrl}`)
    }
    if (match[2] !== TARBALL_FILES[name]) {
      throw new Error(`${name} URL points at an unexpected tarball: ${tarballUrl}`)
    }
  }

  return manifest as PreviewManifest
}

function rewritePackageJson(manifest: PreviewManifest): boolean {
  let text = fs.readFileSync(PACKAGE_PATH, 'utf8')
  let next = text

  for (let name of PINNED_PACKAGES) {
    let url = manifest.packages[name]!
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

function assertLockAt(prefix: string, manifest: PreviewManifest): void {
  let after = readLockState()
  if (after.branchBuilds.length > 0) {
    throw new Error(
      `Lock still contains git-hosted remix refs: ` +
        `${after.branchBuilds.map(short).join(', ')} (${after.branchRefs} refs).`,
    )
  }
  if (after.tarballPrefixes.length !== 1 || after.tarballPrefixes[0] !== prefix) {
    throw new Error(
      `Lock is not unified at t/${prefix}: ` +
        `${after.tarballPrefixes.join(', ') || 'none'} (${after.tarballRefs} refs). ` +
        'The preview branch may have moved during the update; review and rerun.',
    )
  }

  let lock = fs.readFileSync(LOCK_PATH, 'utf8')
  for (let name of PINNED_PACKAGES) {
    let url = manifest.packages[name]!
    if (!lock.includes(url)) throw new Error(`Lock does not reference the ${name} tarball: ${url}`)
  }

  console.log(`Lock unified: ${after.tarballRefs} tarball refs at t/${prefix}`)
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

function findCliInstall(build: string): string {
  let hoisted = path.join(ROOT, 'node_modules/.pnpm/node_modules/@remix-run/cli')
  if (fs.existsSync(path.join(hoisted, 'template/.agents/skills/remix/SKILL.md'))) {
    return hoisted
  }

  // Fallback for layouts without public hoisting. Directory names truncate the
  // build URL at different lengths, so compare a short prefix.
  let virtual = path.join(ROOT, 'node_modules/.pnpm')
  let buildKey = build.slice(0, 7)
  let entries = fs.readdirSync(virtual).filter((entry) => entry.startsWith('@remix-run+cli@'))
  let candidates = [
    ...entries.filter((entry) => entry.includes(buildKey)),
    ...entries.filter((entry) => !entry.includes(buildKey)),
  ]
  for (let cliDir of candidates) {
    let pkg = path.join(virtual, cliDir, 'node_modules/@remix-run/cli')
    if (fs.existsSync(path.join(pkg, 'template/.agents/skills/remix/SKILL.md'))) return pkg
  }
  throw new Error(`No @remix-run/cli install found for ${build}`)
}

function repointSkillLinks(build: string): void {
  let source = path.join(findCliInstall(build), 'template/.agents/skills/remix')
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

  let tip = run('git', ['ls-remote', REMOTE, BRANCH], true).split(/\s+/)[0] ?? ''
  if (!SOURCE_SHA_RE.test(tip)) throw new Error(`Could not resolve ${BRANCH} (got "${tip}")`)

  let manifest = await fetchPreviewManifest(tip)
  let targetPrefix = manifest.sha.slice(0, 8)
  let targetSource = manifest.sha

  console.log('== Remix pin update ==')
  console.log(
    `Current build: ${short(oldPin.build)}${oldPin.source ? ` (source ${short(oldPin.source)})` : ''}` +
      ` [${oldPin.kind}]`,
  )
  console.log(`Target build:  ${short(tip)} -> t/${targetPrefix} (source ${short(targetSource)})`)
  console.log(`Before:        ${installedVersions()}`)
  console.log(
    `Target:        ${PINNED_PACKAGES.map((name) => manifest.packages[name]).join('\n               ')}`,
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
    before.tarballPrefixes.length === 1 &&
    before.tarballPrefixes[0] === targetPrefix
  if (oldPin.kind === 'tarball' && oldPin.build === targetPrefix && lockAtTarget) {
    if (!options.dryRun) repointSkillLinks(targetPrefix)
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
  let rewritten = rewritePackageJson(manifest)
  if (rewritten) console.log('Updated package.json tarball specs')
  let storeFlags = options.storeDir ? ['--store-dir', options.storeDir] : []
  run('pnpm', ['install', '--no-frozen-lockfile', ...NETWORK_FLAGS, ...storeFlags])

  assertLockAt(targetPrefix, manifest)
  assertOnlyPinLinesChanged()

  console.log('\n== Frozen install check ==')
  run('pnpm', ['install', '--frozen-lockfile', ...NETWORK_FLAGS, ...storeFlags])

  console.log('\n== Vendor skill symlink ==')
  repointSkillLinks(targetPrefix)

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
  console.log(`Build: t/${targetPrefix} (source ${targetSource}; preview/main ${short(tip)})`)
  console.log('Record the bump in:')
  console.log('  - AGENTS.md (installed build/source)')
  console.log('  - docs/remix-pin-history.md')
  console.log('  - docs/guide-skill-coverage.md (anchor)')
  console.log(
    '  - .opencode/skills/learned/remix3-tooling/references/remix3-build-and-tooling/upstream-dependency-analysis.md',
  )
  console.log(`Commit: chore(deps): bump remix preview pin to ${targetPrefix}`)
}

main().catch((error: unknown) => {
  console.error(`\nupdate-remix failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
