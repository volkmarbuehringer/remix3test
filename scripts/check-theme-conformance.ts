import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url))
const APP_DIR = path.join(PROJECT_ROOT, 'app')
const THEME_DIR = path.join(APP_DIR, 'ui', 'theme')
const THEME_FILE = path.join(APP_DIR, 'theme.tsx')
const RAW_VAR_RE = /var\(--rmx-/

async function* walk(dir: string): AsyncGenerator<string> {
  let entries = await fs.readdir(dir, { withFileTypes: true })
  for (let entry of entries) {
    if (entry.isDirectory()) {
      if (path.join(dir, entry.name) === THEME_DIR) continue
      yield* walk(path.join(dir, entry.name))
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      yield path.join(dir, entry.name)
    }
  }
}

const violations: string[] = []
for await (let file of walk(APP_DIR)) {
  if (file === THEME_FILE) continue
  let content = await fs.readFile(file, 'utf8')
  for (let [index, line] of content.split('\n').entries()) {
    if (RAW_VAR_RE.test(line)) {
      violations.push(`${path.relative(PROJECT_ROOT, file)}:${index + 1}`)
    }
  }
}

if (violations.length > 0) {
  console.error('Theme conformance violations — raw var(--rmx-...) outside app/ui/theme/:')
  for (let v of violations) console.error('  ' + v)
  console.error('Use the typed `theme` object from app/ui/theme/theme.ts instead.')
  process.exit(1)
}

console.log('Theme conformance: OK (no raw var(--rmx-...) references outside the theme)')
