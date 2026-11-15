import * as fs from 'node:fs'
import * as path from 'node:path'

import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

// `pnpm/action-setup@v6` throws when its `version` input differs from the
// `packageManager` field in package.json ("Multiple versions of pnpm
// specified"). The two CI workflows pin it explicitly, so a pnpm bump must
// update them in the same commit or the manual CI/WebKit runs fail before
// installation. Keep this guard lightweight: it reads the YAML as text rather
// than adding a YAML parser.

const ROOT = path.resolve(import.meta.dirname, '..')

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function expectedPnpmVersion(): string {
  let manifest = JSON.parse(read('package.json')) as { packageManager?: string }
  let packageManager = manifest.packageManager
  if (!packageManager?.startsWith('pnpm@')) {
    throw new Error('package.json must declare packageManager as pnpm@<version>')
  }
  return packageManager.slice('pnpm@'.length).split('+')[0]!
}

describe('CI and image pnpm pin', () => {
  for (let workflow of ['ci.yml', 'webkit.yml']) {
    it(`${workflow} pins pnpm/action-setup to package.json's packageManager`, () => {
      let source = read(`.github/workflows/${workflow}`)
      let setup = source.match(/pnpm\/action-setup@v6[\s\S]*?\n\s+version:\s*(\S+)/)
      assert.ok(setup, `${workflow} must use pnpm/action-setup@v6 with an explicit version`)
      assert.equal(setup[1], expectedPnpmVersion())
    })
  }

  it("Dockerfile installs package.json's packageManager version", () => {
    let dockerfile = read('Dockerfile')
    let install = dockerfile.match(/npm install -g pnpm@(\S+)/)
    assert.ok(install, 'Dockerfile must install pnpm explicitly (no corepack in node:26-slim)')
    assert.equal(install[1], expectedPnpmVersion())
  })
})
