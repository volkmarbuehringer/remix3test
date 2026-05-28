import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.resolve(fileURLToPath(import.meta.url), '../../node_modules/.pnpm')
const targetFile = findTarget(dir)

if (targetFile) {
  let source = fs.readFileSync(targetFile, 'utf-8')
  let patched = source.replace(
    './register-hooks.ts?namespace=',
    './register-hooks.js?namespace=',
  )
  if (source !== patched) {
    fs.writeFileSync(targetFile, patched)
    console.log('[patch] Fixed @remix-run/node-tsx load-module.js (.ts → .js)')
  } else {
    console.log('[patch] @remix-run/node-tsx already patched')
  }
} else {
  console.warn('[patch] Could not find @remix-run/node-tsx load-module.js')
}

function findTarget(rootDir) {
  try {
    let entries = fs.readdirSync(rootDir)
    for (let entry of entries) {
      if (!entry.startsWith('@remix-run+node-tsx@')) continue
      let file = path.join(rootDir, entry, 'node_modules/@remix-run/node-tsx/dist/lib/load-module.js')
      if (fs.existsSync(file)) return file
    }
  } catch {
    // directory may not exist
  }
  return null
}
