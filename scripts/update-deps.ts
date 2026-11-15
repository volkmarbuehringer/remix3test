import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

// ---------------------------------------------------------------------------
// Interactively bump outdated dependencies.
//
// `pnpm update --latest --interactive` lists every outdated direct dependency
// with its current and latest version and applies only the ones selected, so
// major bumps are reviewed one at a time (the "safe" default is to update only
// compatible ranges with `pnpm update`). Extra arguments are forwarded to pnpm,
// e.g. `npm run update:deps -- --dev`.
//
// The remix packages are pinned to preview release tarball URLs, not registry
// ranges: this script leaves them alone, and `npm run update:remix` bumps them.
//
// pnpm does not remember the store node_modules was linked from, so the store
// recorded in node_modules/.modules.yaml (falling back to ./.pnpm-store) is
// exported as npm_config_* / pnpm_config_* variables and passed as
// --store-dir. XDG_RUNTIME_DIR is redirected next to that store because pnpm 12
// keeps store-operation locks there and sandboxes deny writes outside the
// workspace. scripts/update-remix.ts performs the same setup.
// ---------------------------------------------------------------------------

const ROOT = path.resolve(import.meta.dirname, '..')
const PACKAGE_PATH = path.join(ROOT, 'package.json')
const DEFAULT_STORE = path.join(ROOT, '.pnpm-store')

function linkedStore(): string | undefined {
  try {
    let modules = fs.readFileSync(path.join(ROOT, 'node_modules/.modules.yaml'), 'utf8')
    return /"?storeDir"?\s*:\s*"([^"]+)"/.exec(modules)?.[1]
  } catch {
    return undefined
  }
}

function runtimeDir(cacheDir: string): string {
  let dir = path.join(cacheDir, 'runtime')
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  fs.chmodSync(dir, 0o700)
  return dir
}

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

// Direct dependencies pinned to URLs or local paths cannot be bumped from the
// registry; report them so an "everything is up to date" run is not mistaken
// for a fully current manifest.
function nonRegistryPackages(): string[] {
  let manifest = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8')) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  let specs = { ...manifest.dependencies, ...manifest.devDependencies }
  return Object.entries(specs)
    .filter(([, spec]) => /^(?:https?:|github:|git\+|file:|link:|workspace:)/.test(spec))
    .map(([name]) => name)
}

function main(): void {
  if (!process.stdin.isTTY) {
    throw new Error(
      'pnpm update --interactive needs a terminal; run this from an interactive shell',
    )
  }

  let storeDir = linkedStore() ?? (fs.existsSync(DEFAULT_STORE) ? DEFAULT_STORE : undefined)
  let storeFlags = storeDir ? ['--store-dir', storeDir] : []

  let pinned = nonRegistryPackages()
  if (pinned.length > 0) {
    console.log(`Non-registry specs (not updated here): ${pinned.join(', ')}`)
    if (pinned.includes('remix')) {
      console.log('Bump the remix preview pin with: npm run update:remix')
    }
    console.log('')
  }

  let forwarded = process.argv.slice(2)
  let args = ['update', '--latest', '--interactive', ...storeFlags, ...forwarded]
  let result = spawnSync('pnpm', args, {
    cwd: ROOT,
    env: environmentForStore(storeDir),
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1

  let helpOnly = forwarded.includes('--help') || forwarded.includes('-h')
  if (result.status === 0 && !helpOnly) {
    console.log(
      '\nNext: review `git diff package.json pnpm-lock.yaml`, then run `npm run typecheck` and `npm test`.',
    )
  }
}

try {
  main()
} catch (error: unknown) {
  console.error(`update-deps failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
