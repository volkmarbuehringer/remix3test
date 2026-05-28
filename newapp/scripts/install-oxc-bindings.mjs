#!/usr/bin/env node
/**
 * Creates symlinks for oxc native bindings so they can be resolved
 * via `require('./foo.linux-x64-gnu.node')` in child processes.
 *
 * These symlinks live inside the pnpm virtual store and are lost on
 * `rm -rf node_modules && pnpm install`. This script is meant to be run
 * as a `postinstall` hook to recreate them.
 */

import { existsSync, mkdirSync, symlinkSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// Platform binding suffix (e.g., linux-x64-gnu, darwin-arm64)
const platform = process.platform
const arch = process.arch
const suffix = `${platform}-${arch}${platform === 'linux' ? '-gnu' : ''}`

// Each entry: [packageName, bindingScope, nodeFileName, relativeBindingsPath]
// The relative path goes from the .node file's location to the binding package
const ENTRIES = [
  {
    pkg: 'oxc-minify',
    scope: '@oxc-minify',
    // Local file ref'd by requireNative() in oxc-minify/index.js
    localFiles: [`minify.${suffix}.node`],
    // The binding package stores its .node file at this subpath
    bindingFile: `minify.${suffix}.node`,
  },
  {
    pkg: 'oxc-resolver',
    scope: '@oxc-resolver',
    localFiles: [`resolver.${suffix}.node`],
    bindingFile: `resolver.${suffix}.node`,
  },
  {
    pkg: 'oxc-transform',
    scope: '@oxc-transform',
    localFiles: [`transform.${suffix}.node`],
    bindingFile: `transform.${suffix}.node`,
  },
  {
    pkg: 'oxc-parser',
    scope: '@oxc-parser',
    localFiles: [`parser.${suffix}.node`],
    bindingFile: `parser.${suffix}.node`,
    // oxc-parser has bindings.js in src-js/ subdir
    subdir: 'src-js',
  },
]

const STORE_PREFIX = 'node_modules/.pnpm'

for (const entry of ENTRIES) {
  // Find the pnpm store directory for this package
  const storeGlob = resolve(root, STORE_PREFIX)
  const pkgDirs = entry.pkg

  let foundDir = null
  try {
    const fs = await import('node:fs')
    const dirs = fs.readdirSync(storeGlob)
    for (const dir of dirs) {
      if (dir.startsWith(`${pkgDirs}@`)) {
        const pkgDir = resolve(storeGlob, dir, 'node_modules', pkgDirs)
        if (existsSync(pkgDir)) {
          foundDir = pkgDir
          break
        }
      }
    }
  } catch {
    // no-op
  }

  if (!foundDir) {
    console.warn(`[oxc-bindings] Could not find ${entry.pkg} in pnpm store, skipping`)
    continue
  }

  const targetDir = entry.subdir ? resolve(foundDir, entry.subdir) : foundDir

  for (const localFile of entry.localFiles) {
    const symlinkPath = resolve(targetDir, localFile)
    if (existsSync(symlinkPath)) {
      // Already exists, skip
      continue
    }

    // The symlink target: from the package dir to the binding in parent node_modules
    // e.g., ../@oxc-minify/binding-linux-x64-gnu/minify.linux-x64-gnu.node
    const relToPkg = entry.subdir ? '../../' : '../'
    const symlinkTarget = `${relToPkg}${entry.scope}/binding-${suffix}/${entry.bindingFile}`

    try {
      symlinkSync(symlinkTarget, symlinkPath)
      console.log(`[oxc-bindings] ✓ Created symlink for ${entry.pkg}/${localFile}`)
    } catch (err) {
      console.error(`[oxc-bindings] ✗ Failed to create symlink for ${entry.pkg}/${localFile}:`, err.message)
    }
  }
}

console.log('[oxc-bindings] Done')
