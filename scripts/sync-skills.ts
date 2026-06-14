import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url))

async function findCliPackage(): Promise<string | null> {
  // Check pnpm store for @remix-run/cli
  let pnpmDir = path.join(PROJECT_ROOT, 'node_modules/.pnpm')
  try {
    let entries = await fs.readdir(pnpmDir)
    let cliDir = entries.find(e => e.startsWith('@remix-run+cli@'))
    if (cliDir) {
      let p = path.join(pnpmDir, cliDir, 'node_modules/@remix-run/cli')
      let s = await fs.stat(p)
      if (s.isDirectory()) return p
    }
  } catch {}
  return null
}

async function copyDir(src: string, dest: string) {
  await fs.mkdir(dest, { recursive: true })
  let entries = await fs.readdir(src, { withFileTypes: true })
  for (let entry of entries) {
    let s = path.join(src, entry.name)
    let d = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      await copyDir(s, d)
    } else {
      await fs.copyFile(s, d)
    }
  }
}

async function main() {
  let cliPkg = await findCliPackage()
  if (!cliPkg) {
    console.error('@remix-run/cli not found in pnpm store. Run npm install.')
    process.exit(1)
  }

  let sourceDir = path.join(cliPkg, 'template/.agents/skills/remix')
  let opencodeTarget = path.join(PROJECT_ROOT, '.opencode/skills/remix')

  console.log(`Syncing remix skill from ${sourceDir}`)
  await copyDir(sourceDir, opencodeTarget)
  console.log('Done.')
}

main().catch(console.error)
