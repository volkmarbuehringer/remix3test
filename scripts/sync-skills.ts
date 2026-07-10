import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url))

async function findCliPackage(): Promise<string | null> {
  let pnpmDir = path.join(PROJECT_ROOT, 'node_modules/.pnpm')
  try {
    // Get the pnpm store entry name from the currently installed remix package
    let remixLink = await fs.readlink(path.join(PROJECT_ROOT, 'node_modules/remix'))
    // Extract the git commit hash from the store dir name
    // .pnpm/remix@https+++...tar.gz+<COMMIT_HASH>cb5c2d.../node_modules/remix
    let commitMatch = remixLink.match(/tar\.gz\+([a-f0-9]{7,})/)?.[1] || ''
    // The CLI shares the same commit hash prefix in its pnpm store entry
    let commitPrefix = commitMatch.slice(0, 9)

    let entries = await fs.readdir(pnpmDir)
    let cliDir = entries.find((e) => e.startsWith('@remix-run+cli@') && e.includes(commitPrefix))
    if (cliDir) {
      let p = path.join(pnpmDir, cliDir, 'node_modules/@remix-run/cli')
      let s = await fs.stat(p)
      if (s.isDirectory()) return p
    }
  } catch {}
  return null
}

async function main() {
  let cliPkg = await findCliPackage()
  if (!cliPkg) {
    console.error('@remix-run/cli not found in pnpm store. Run npm install.')
    process.exit(1)
  }

  let sourceDir = path.join(cliPkg, 'template/.agents/skills/remix')
  let linkPath = path.join(PROJECT_ROOT, '.opencode/skills/remix')

  // Remove existing skill (file, dir, or broken symlink)
  try {
    let existing = await fs.lstat(linkPath)
    if (existing.isSymbolicLink() || existing.isDirectory() || existing.isFile()) {
      await fs.rm(linkPath, { recursive: true, force: true })
    }
  } catch {}

  // Create symlink
  await fs.symlink(sourceDir, linkPath, 'dir')
  console.log(`Linked remix skill: ${linkPath} → ${sourceDir}`)
}

main().catch(console.error)
