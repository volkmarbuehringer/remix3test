import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  dockerfilePinVersion,
  expectedPnpmVersion,
  findPnpmPinMismatches,
  syncPnpmPins,
  workflowPinVersion,
} from './pnpm-pin.ts'

// `pnpm/action-setup@v6` throws when its `version` input differs from the
// `packageManager` field in package.json ("Multiple versions of pnpm
// specified"). The CI workflows pin it explicitly, so a pnpm bump must update
// them in the same commit or the manual CI/WebKit runs fail before
// installation. `npm run check:pnpm` runs the same parser without a test
// harness, and `npm run update:deps` syncs the pins after a bump.

const ROOT = path.resolve(import.meta.dirname, '..')

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

describe('CI and image pnpm pin', () => {
  for (let workflow of ['ci.yml', 'webkit.yml', 'preflight.yml']) {
    it(`${workflow} pins pnpm/action-setup to package.json's packageManager`, () => {
      let source = read(`.github/workflows/${workflow}`)
      let version = workflowPinVersion(source)
      assert.ok(version, `${workflow} must use pnpm/action-setup@v6 with an explicit version`)
      assert.equal(version, expectedPnpmVersion(ROOT))
    })
  }

  it("Dockerfile installs package.json's packageManager version", () => {
    let dockerfile = read('Dockerfile')
    let version = dockerfilePinVersion(dockerfile)
    assert.ok(version, 'Dockerfile must install pnpm explicitly (no corepack in node:26-slim)')
    assert.equal(version, expectedPnpmVersion(ROOT))
  })

  it('syncPnpmPins rewrites every consumer from packageManager', () => {
    let root = fs.mkdtempSync(path.join(os.tmpdir(), 'pnpm-pin-'))
    try {
      fs.mkdirSync(path.join(root, '.github/workflows'), { recursive: true })
      fs.writeFileSync(
        path.join(root, 'package.json'),
        JSON.stringify({ packageManager: 'pnpm@12.23.0' }),
      )
      for (let workflow of ['ci.yml', 'webkit.yml', 'preflight.yml']) {
        fs.writeFileSync(
          path.join(root, `.github/workflows/${workflow}`),
          'steps:\n  - uses: pnpm/action-setup@v6\n    with:\n      version: 12.21.0\n',
        )
      }
      fs.writeFileSync(path.join(root, 'Dockerfile'), 'RUN npm install -g pnpm@12.21.0\n')

      assert.equal(findPnpmPinMismatches(root).length, 4)

      let changed = syncPnpmPins(root)
      assert.equal(changed.length, 4, 'all four consumers should be rewritten')
      assert.deepEqual(findPnpmPinMismatches(root), [])
      assert.ok(readFrom(root, 'Dockerfile').includes('pnpm@12.23.0'))
      assert.ok(
        readFrom(root, '.github/workflows/ci.yml').includes('version: 12.23.0'),
        'the workflow version input should be rewritten',
      )
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

function readFrom(root: string, relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}
