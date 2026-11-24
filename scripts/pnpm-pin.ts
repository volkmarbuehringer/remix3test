import * as fs from 'node:fs'
import * as path from 'node:path'

// `pnpm/action-setup@v6` throws when its `version` input differs from the
// `packageManager` field in package.json ("Multiple versions of pnpm
// specified"), and the Docker image installs pnpm explicitly because Node
// images do not bundle corepack. `pnpm update` can rewrite `packageManager`,
// so every consumer has to move with it in the same change.
//
// This module owns the parsing/rewriting; `scripts/check-pnpm-version.ts` is
// the dependency-free CI/preflight gate and `scripts/update-deps.ts` calls
// `syncPnpmPins()` after a successful update.

const PACKAGE_PATH = 'package.json'
const WORKFLOW_FILES = [
  '.github/workflows/ci.yml',
  '.github/workflows/webkit.yml',
  '.github/workflows/preflight.yml',
] as const
const DOCKERFILE = 'Dockerfile'

const WORKFLOW_VERSION_RE = /(pnpm\/action-setup@v6[\s\S]*?\n\s+version:\s*)(\S+)/
const DOCKERFILE_VERSION_RE = /(npm install -g pnpm@)(\S+)/

export type PnpmPinMismatch = {
  file: string
  expected: string
  actual: string | undefined
}

function read(root: string, relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

/** The version after `pnpm@` in package.json's `packageManager` field. */
export function expectedPnpmVersion(root: string): string {
  let manifest = JSON.parse(read(root, PACKAGE_PATH)) as { packageManager?: string }
  let packageManager = manifest.packageManager
  if (!packageManager?.startsWith('pnpm@')) {
    throw new Error('package.json must declare packageManager as pnpm@<version>')
  }
  return packageManager.slice('pnpm@'.length).split('+')[0]!
}

/** The version pinned by a workflow's `pnpm/action-setup@v6` step, if present. */
export function workflowPinVersion(source: string): string | undefined {
  return WORKFLOW_VERSION_RE.exec(source)?.[2]
}

/** The version installed by the Dockerfile's global pnpm install, if present. */
export function dockerfilePinVersion(source: string): string | undefined {
  return DOCKERFILE_VERSION_RE.exec(source)?.[2]
}

export function findPnpmPinMismatches(root: string): PnpmPinMismatch[] {
  let expected = expectedPnpmVersion(root)
  let mismatches: PnpmPinMismatch[] = []

  for (let file of WORKFLOW_FILES) {
    let actual = workflowPinVersion(read(root, file))
    if (actual !== expected) mismatches.push({ file, expected, actual })
  }

  let dockerfile = dockerfilePinVersion(read(root, DOCKERFILE))
  if (dockerfile !== expected) {
    mismatches.push({ file: DOCKERFILE, expected, actual: dockerfile })
  }

  return mismatches
}

/**
 * Rewrites every consumer to package.json's `packageManager` version.
 * Returns the files that changed; a failed match is left for the checker.
 */
export function syncPnpmPins(root: string): string[] {
  let expected = expectedPnpmVersion(root)
  let changed: string[] = []

  for (let file of WORKFLOW_FILES) {
    let source = read(root, file)
    let next = source.replace(
      WORKFLOW_VERSION_RE,
      (_match, prefix: string) => `${prefix}${expected}`,
    )
    if (next !== source) {
      fs.writeFileSync(path.join(root, file), next)
      changed.push(file)
    }
  }

  let dockerfile = read(root, DOCKERFILE)
  let nextDockerfile = dockerfile.replace(
    DOCKERFILE_VERSION_RE,
    (_match, prefix: string) => `${prefix}${expected}`,
  )
  if (nextDockerfile !== dockerfile) {
    fs.writeFileSync(path.join(root, DOCKERFILE), nextDockerfile)
    changed.push(DOCKERFILE)
  }

  return changed
}
