import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Shared skill-sync helpers for the repo's agent skill setup.
 *
 * Two conventions are maintained here:
 *
 * 1. The vendor `remix` skill ships inside `@remix-run/cli` (same pnpm-store
 *    commit as the `remix` package) and is symlinked into both
 *    `.opencode/skills/remix` and `.agents/skills/remix`.
 * 2. The repo-maintained learned skills live in `.opencode/skills/learned/`
 *    (git-tracked) and are exposed to agent harnesses that scan
 *    `.agents/skills/` via one top-level symlink each
 *    (`.agents/skills/<name> -> ../../.opencode/skills/learned/<name>`).
 *    Harness discovery is one directory level deep only, so a nested
 *    `.agents/skills/learned/<name>/SKILL.md` would never be found.
 *
 * Both conventions use symlinks relative to the link's directory, so the
 * repo stays the single source of truth and there is nothing to drift.
 */

const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url))

const OPENCODE_SKILLS_DIR = path.join(PROJECT_ROOT, '.opencode/skills')
const AGENTS_SKILLS_DIR = path.join(PROJECT_ROOT, '.agents/skills')
const LEARNED_SKILLS_DIR = path.join(OPENCODE_SKILLS_DIR, 'learned')

/** Kebab-case skill-name grammar used by harness skill catalogs. */
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Locate the `@remix-run/cli` package in the pnpm store that belongs to the
 * currently installed `remix` build.
 *
 * The public-hoisted link (`.npmrc` publishes `@remix-run/*`) is authoritative:
 * pnpm truncates the tarball URL inside `.pnpm` directory names to different
 * lengths per package, so directory-name matching alone is not reliable.
 */
async function findCliPackage(): Promise<string | null> {
  let hoisted = path.join(PROJECT_ROOT, 'node_modules/.pnpm/node_modules/@remix-run/cli')
  try {
    if ((await fs.stat(path.join(hoisted, 'template/.agents/skills/remix'))).isDirectory()) {
      return hoisted
    }
  } catch {}

  let pnpmDir = path.join(PROJECT_ROOT, 'node_modules/.pnpm')
  try {
    // Fallback: match the release tag (or the historical build prefix) from the
    // installed remix link, then any CLI. The directory name may keep only a
    // truncated part of the tag (for example `…download+v0.20261105.172537`), so
    // compare a short prefix.
    let remixLink = await fs.readlink(path.join(PROJECT_ROOT, 'node_modules/remix'))
    let tagMatch = remixLink.match(/releases\+download\+([^+/]+)/)?.[1] || ''
    let commitMatch = remixLink.match(/(?:tar\.gz\+|t\+)([a-f0-9]{7,40})/)?.[1] || ''
    let key = (tagMatch || commitMatch).slice(0, 24)

    let entries = await fs.readdir(pnpmDir)
    let candidates = [
      ...entries.filter((e) => e.startsWith('@remix-run+cli@') && e.includes(key)),
      ...entries.filter((e) => e.startsWith('@remix-run+cli@') && !e.includes(key)),
    ]
    for (let cliDir of candidates) {
      let p = path.join(pnpmDir, cliDir, 'node_modules/@remix-run/cli')
      let template = path.join(p, 'template/.agents/skills/remix')
      try {
        if ((await fs.stat(template)).isDirectory()) return p
      } catch {}
    }
  } catch {}
  return null
}

/** Remove a filesystem entry whether it is a file, directory, or symlink. */
async function removeEntry(target: string): Promise<void> {
  try {
    let existing = await fs.lstat(target)
    if (existing.isSymbolicLink() || existing.isDirectory() || existing.isFile()) {
      await fs.rm(target, { recursive: true, force: true })
    }
  } catch {}
}

/** Replace `linkPath` with a symlink to `sourceDir`, relative to the link's directory. */
async function linkSkill(sourceDir: string, linkPath: string): Promise<void> {
  await removeEntry(linkPath)
  let target = path.relative(path.dirname(linkPath), sourceDir)
  await fs.symlink(target, linkPath, 'dir')
}

/**
 * Link the vendor `remix` skill into both `.opencode/skills/remix` and
 * `.agents/skills/remix`. Returns the link paths that were (re)created.
 * Throws when `@remix-run/cli` cannot be found.
 */
export async function syncVendorSkill(cliPkg?: string): Promise<string[]> {
  let pkg = cliPkg ?? (await findCliPackage())
  if (!pkg) {
    throw new Error('@remix-run/cli not found in pnpm store. Run npm install.')
  }

  let sourceDir = path.join(pkg, 'template/.agents/skills/remix')
  let links = [path.join(OPENCODE_SKILLS_DIR, 'remix'), path.join(AGENTS_SKILLS_DIR, 'remix')]

  await fs.mkdir(AGENTS_SKILLS_DIR, { recursive: true })
  for (let linkPath of links) {
    await linkSkill(sourceDir, linkPath)
  }
  return links
}

/**
 * Ensure `.agents/skills/` exposes every skill owned by `.opencode/skills/` as
 * a top-level symlink (the only shape harness discovery finds), and remove
 * farm symlinks whose source is gone. Farmed sources:
 *
 * - `.opencode/skills/learned/<name>` → `.agents/skills/<name>`
 * - top-level `.opencode/skills/<name>` directory bundles (e.g. `openspec-*`)
 *
 * Entries the farm does not own — the vendor `remix` link (synced separately)
 * and `mastra` (installed via the harness lock file) — are left untouched.
 * Replacing a previously copied directory with a farm link is intentional:
 * copies of tracked skills drift, symlinks cannot.
 */
export async function syncSkillFarm(): Promise<{ created: string[]; removed: string[] }> {
  await fs.mkdir(AGENTS_SKILLS_DIR, { recursive: true })

  // name -> absolute source directory currently farmed
  let farmTargets = new Map<string, string>()

  let learnedEntries = await fs.readdir(LEARNED_SKILLS_DIR, { withFileTypes: true })
  for (let entry of learnedEntries) {
    if (!entry.isDirectory() || !SKILL_NAME.test(entry.name)) continue
    farmTargets.set(entry.name, path.join(LEARNED_SKILLS_DIR, entry.name))
  }

  let opencodeEntries = await fs.readdir(OPENCODE_SKILLS_DIR, { withFileTypes: true })
  for (let entry of opencodeEntries) {
    if (!entry.isDirectory() || entry.name === 'learned' || !SKILL_NAME.test(entry.name)) continue
    farmTargets.set(entry.name, path.join(OPENCODE_SKILLS_DIR, entry.name))
  }

  let created: string[] = []
  for (let [name, target] of farmTargets) {
    let linkPath = path.join(AGENTS_SKILLS_DIR, name)
    let expected = path.relative(AGENTS_SKILLS_DIR, target)

    try {
      let existing = await fs.lstat(linkPath)
      if (existing.isSymbolicLink() && (await fs.readlink(linkPath)) === expected) continue
    } catch {}

    await linkSkill(target, linkPath)
    created.push(name)
  }

  let removed: string[] = []
  let agentsEntries = await fs.readdir(AGENTS_SKILLS_DIR, { withFileTypes: true })
  for (let entry of agentsEntries) {
    if (!entry.isSymbolicLink()) continue
    let linkPath = path.join(AGENTS_SKILLS_DIR, entry.name)
    let target: string
    try {
      target = await fs.readlink(linkPath)
    } catch {
      continue
    }
    let resolved = path.resolve(AGENTS_SKILLS_DIR, target)
    let rel = path.relative(OPENCODE_SKILLS_DIR, resolved)
    // Only manage symlinks that point into the farmed .opencode/skills tree.
    if (rel.startsWith('..') || path.isAbsolute(rel)) continue
    if (!farmTargets.has(entry.name)) {
      await fs.rm(linkPath, { recursive: true, force: true })
      removed.push(entry.name)
    }
  }

  return { created, removed }
}
