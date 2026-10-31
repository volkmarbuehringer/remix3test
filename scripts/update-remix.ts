import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

// ---------------------------------------------------------------------------
// Bump the `github:remix-run/remix#preview/main&path:` pin.
//
// The package.json specs intentionally stay on the branch; the unified
// pnpm-lock.yaml is the real pin (the tarball's internal @remix-run/* deps still
// point at #preview/main, so SHA-pinning only the two top-level specs can mix
// builds — see pnpm-git-hosted-installs.md).
//
// Steps: resolve preview/main -> pnpm update -> verify one build in the lock ->
// frozen-install consistency check -> repoint the vendor skill symlink ->
// typecheck/lint/format (+ full tests unless --no-tests).
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
const SHA_RE = /^[0-9a-f]{40}$/
// pnpm truncates the git SHA inside .pnpm dir names, and the kept length varies
// per package (…+57ecca4cba2d566_… vs …+57ecca4cba2_…). Ten hex chars match
// every install of a build while staying distinct from other builds.
const BUILD_KEY_LENGTH = 10

type Options = {
  dryRun: boolean
  noTests: boolean
  allowDirty: boolean
  storeDir: string | undefined
}

type CommitInfo = {
  message: string
  parents: string[]
}

type LockState = {
  count: number
  builds: string[]
}

function usage(): void {
  console.log(`Usage: npm run update:remix -- [options]

Resolve github.com/remix-run/remix preview/main, run the pnpm update, verify the
lock has one unified build, repoint .agents/skills/remix, then run typecheck,
lint, format and (by default) the full test suite.

Options:
  --dry-run           Resolve and print the target build/commits; change nothing
  --no-tests          Skip the full \`npm test\` run
  --allow-dirty       Allow an uncommitted working tree
  --store-dir <dir>   pnpm store (default: ./.pnpm-store when it exists)
  -h, --help          Show this help

The package.json specs stay on #preview/main; the unified lockfile is the pin.
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
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited ${result.status ?? 'without a status'}`)
  }
  return capture ? (result.stdout ?? '').trim() : ''
}

function readLockState(): LockState {
  let lock = fs.readFileSync(LOCK_PATH, 'utf8')
  let refs = [...lock.matchAll(/tar\.gz\/([0-9a-f]{40})/g)]
    .map((match) => match[1])
    .filter((ref): ref is string => Boolean(ref))
  return { count: refs.length, builds: [...new Set(refs)] }
}

function readPackageJson(): { dependencies?: Record<string, string> } {
  return JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'))
}

function assertBranchSpecs(): void {
  let dependencies = readPackageJson().dependencies ?? {}
  for (let name of ['remix', '@remix-run/ui']) {
    let spec = dependencies[name]
    if (!spec?.startsWith('github:remix-run/remix#preview/main&path:')) {
      throw new Error(
        `${name} is not pinned to github:remix-run/remix#preview/main ` +
          `(got ${spec ?? 'missing'}). This script only updates the branch pin.`,
      )
    }
  }
}

function versionAt(...segments: string[]): string | undefined {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, ...segments), 'utf8')).version
  } catch {
    return undefined
  }
}

function virtualVersion(pkg: string, build: string): string | undefined {
  let virtual = path.join(ROOT, 'node_modules/.pnpm')
  let buildKey = build.slice(0, BUILD_KEY_LENGTH)
  try {
    let dir = fs
      .readdirSync(virtual)
      .find((entry) => entry.startsWith(`@remix-run+${pkg}@`) && entry.includes(buildKey))
    return dir
      ? versionAt('node_modules/.pnpm', dir, `node_modules/@remix-run/${pkg}/package.json`)
      : undefined
  } catch {
    return undefined
  }
}

function installedVersions(build: string): string {
  let versions = [
    ['remix', versionAt('node_modules/remix/package.json')],
    ['@remix-run/ui', versionAt('node_modules/@remix-run/ui/package.json')],
    ['component', virtualVersion('component', build)],
    ['component-hmr', virtualVersion('component-hmr', build)],
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
      commit?: { message?: string }
      parents?: Array<{ sha?: string }>
    }
    return {
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

function repointSkillLink(build: string): void {
  let link = path.join(ROOT, '.agents/skills/remix')
  let virtual = path.join(ROOT, 'node_modules/.pnpm')
  let buildKey = build.slice(0, BUILD_KEY_LENGTH)
  let cliDir = fs
    .readdirSync(virtual)
    .find((entry) => entry.startsWith('@remix-run+cli@') && entry.includes(buildKey))
  if (!cliDir) throw new Error(`No @remix-run/cli install found for ${build}`)

  let target = path.join(
    virtual,
    cliDir,
    'node_modules/@remix-run/cli/template/.agents/skills/remix',
  )
  if (!fs.existsSync(path.join(target, 'SKILL.md'))) {
    throw new Error(`CLI template skill is missing: ${target}`)
  }

  let relativeTarget = path.relative(path.dirname(link), target)
  let currentTarget = fs.existsSync(link) ? fs.readlinkSync(link) : undefined
  if (currentTarget === relativeTarget) {
    console.log('.agents/skills/remix already points at the new CLI template')
    return
  }

  fs.rmSync(link, { force: true })
  fs.symlinkSync(relativeTarget, link)
  console.log(`Repointed .agents/skills/remix -> ${relativeTarget}`)
}

async function main(): Promise<void> {
  let options = parseOptions(process.argv.slice(2))
  assertBranchSpecs()

  if (!options.dryRun && !options.allowDirty) {
    let dirty = run('git', ['status', '--porcelain'], true)
    if (dirty) {
      throw new Error(
        `Working tree is not clean:\n${dirty}\nCommit/stash first, or pass --allow-dirty.`,
      )
    }
  }

  let before = readLockState()
  let oldBuild = before.builds[0]
  let oldInfo = oldBuild ? await githubCommit(oldBuild) : undefined
  let oldSource = oldInfo?.parents[0]

  let tip = run('git', ['ls-remote', REMOTE, BRANCH], true).split(/\s+/)[0] ?? ''
  if (!SHA_RE.test(tip)) throw new Error(`Could not resolve ${BRANCH} (got "${tip}")`)

  let tipInfo = await githubCommit(tip)
  let tipSource = tipInfo?.parents[0]

  console.log('== Remix pin update ==')
  console.log(
    `Current build: ${oldBuild ? short(oldBuild) : 'unknown'}${oldSource ? ` (source ${short(oldSource)})` : ''}`,
  )
  console.log(`Target build:  ${short(tip)}${tipSource ? ` (source ${short(tipSource)})` : ''}`)
  if (oldBuild) console.log(`Before:        ${installedVersions(oldBuild)}`)
  console.log(`Target:        ${tip}`)

  if (oldSource && tipSource && oldSource !== tipSource) {
    let subjects = await compareCommits(oldSource, tipSource)
    if (subjects?.length) {
      console.log('Commits:')
      for (let subject of subjects) console.log(`  - ${subject}`)
    }
  }

  if (oldBuild === tip) {
    console.log('\nAlready up to date; nothing to do.')
    return
  }

  if (options.dryRun) {
    console.log('\nDry run: would run pnpm update remix @remix-run/ui.')
    return
  }

  console.log('\n== Installing ==')
  let storeFlags = options.storeDir ? ['--store-dir', options.storeDir] : []
  run('pnpm', ['update', 'remix', '@remix-run/ui', ...NETWORK_FLAGS, ...storeFlags])

  let after = readLockState()
  if (after.builds.length !== 1 || after.builds[0] !== tip) {
    throw new Error(
      `Lock is not unified at ${tip}: ${after.builds.map(short).join(', ') || 'none'} ` +
        `(${after.count} refs). The branch may have moved during the update; review and rerun.`,
    )
  }
  console.log(`Lock unified: ${after.count} refs at ${tip}`)

  let packageChanged = run('git', ['diff', '--', 'package.json'], true)
  if (packageChanged) {
    console.error('\nWARNING: package.json changed during the update:')
    console.error(packageChanged)
    console.error('Review it and either complete the change in the lock or revert it.')
    process.exitCode = 1
  }

  console.log('\n== Frozen install check ==')
  run('pnpm', ['install', '--frozen-lockfile', ...NETWORK_FLAGS, ...storeFlags])

  console.log('\n== Vendor skill symlink ==')
  repointSkillLink(tip)

  console.log(`\nVersions: ${installedVersions(tip)}`)

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
  console.log(`Build: ${tip}${tipSource ? ` (source ${short(tipSource)})` : ''}`)
  console.log('Record the bump in:')
  console.log('  - AGENTS.md (installed build/source)')
  console.log('  - docs/guide-skill-coverage.md (anchor)')
  console.log(
    '  - .opencode/skills/learned/remix3-tooling/references/remix3-build-and-tooling/upstream-dependency-analysis.md',
  )
  console.log(`Commit: chore(deps): bump remix preview pin to ${short(tip)}`)
}

main().catch((error: unknown) => {
  console.error(`\nupdate-remix failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
