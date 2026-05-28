<!-- Context: development/remix3/lookup/browser-shims | Priority: high | Version: 1.0 | Updated: 2026-04-04 -->

# Lookup: Browser Asset Build Configuration

**Purpose**: Configuration for building browser assets (clientEntry components) without CORS errors from Node.js built-ins

## Problem
When bundling browser assets with esbuild, Node.js built-in modules (`node:fs`, `node:path`, `node:url`, `node:async_hooks`) cause CORS errors:
```
Cross-Origin Request Blocked: CORS request was not http
Module source URI not allowed: "node:fs"
```
Remix packages (session, async-context-middleware) import Node.js built-ins. Browser can't import `node:` protocol modules. Externalizing with `--external:node:*` doesn't work - esbuild still emits `import` statements.

## Solution: Browser Shims
Create a browser-shims.js file with polyfills and use esbuild aliases:

```javascript
// Browser polyfills for Node.js built-ins
const mockDirStats = { isDirectory: () => true, isFile: () => false, isBlockDevice: () => false, isCharacterDevice: () => false, isSymbolicLink: () => false, isFIFO: () => false, isSocket: () => false, size: 0, mode: 0, ino: 0, dev: 0, uid: 0, gid: 0, atime: new Date(), mtime: new Date(), ctime: new Date(), birthtime: new Date() }

// fs
export const mkdirSync = () => undefined
export const readFileSync = () => undefined
export const writeFileSync = () => undefined
export const existsSync = () => true
export const statSync = () => mockDirStats
export const readdirSync = () => []
export const rmdirSync = () => undefined
export const unlinkSync = () => undefined
export const readFile = () => Promise.resolve(undefined)
export const writeFile = () => Promise.resolve(undefined)
export const mkdir = () => Promise.resolve(undefined)

// fs/promises
export const promises = { readFile: () => Promise.resolve(undefined), writeFile: () => Promise.resolve(undefined), mkdir: () => Promise.resolve(undefined), stat: () => Promise.resolve(mockDirStats), readdir: () => Promise.resolve([]), unlink: () => Promise.resolve(undefined) }

// path
export function resolve(...segments) { return segments.filter(Boolean).join('/') }
export function join(...segments) { return segments.filter(Boolean).join('/') }
export function dirname(p) { const parts = p.replace(/\/$/, '').split('/'); parts.pop(); return parts.join('/') || '.' }
export function basename(p, ext) { const base = p.split('/').pop() || ''; if (ext && base.endsWith(ext)) return base.slice(0, -ext.length); return base }
export function extname(p) { const base = p.split('/').pop() || ''; const dotIdx = base.lastIndexOf('.'); return dotIdx > 0 ? base.slice(dotIdx) : '' }
export function isAbsolute(p) { return p.startsWith('/') || !!p.match(/^[a-zA-Z]:/) }
export function normalize(p) { return p.replace(/\/+/g, '/').replace(/\/+$/, '') }
export const sep = '/'; export const delimiter = ':'

// url
export function fileURLToPath(u) { if (typeof u === 'string') u = new URL(u); return u.pathname }
export function pathToFileURL(p) { return new URL('file://' + p) }

// AsyncLocalStorage
export const AsyncLocalStorage = class AsyncLocalStorage { static asyncEnterWith() {} static asyncExitThen() {} }
```

### esbuild Configuration
```json
"dev:browser": "esbuild app/assets/*.tsx --outbase=app/assets --outdir=public/assets --bundle --minify --splitting --format=esm --entry-names='[dir]/[name]' --chunk-names='chunks/[name]-[hash]' --sourcemap --watch --alias:node:fs=./browser-shims.js --alias:node:fs/promises=./browser-shims.js --alias:node:path=./browser-shims.js --alias:node:url=./browser-shims.js --alias:node:async_hooks=./browser-shims.js"
```

## Key Points
1. **statSync must return object with isDirectory()** - Session storage checks if path is a directory
2. **existsSync should return true** - Prevents "path does not exist" errors
3. **Use aliases, not externals** - `--external` still emits import statements that cause CORS
4. **All exports must be direct**, not nested objects - esbuild won't match named exports otherwise

## Related
- lookup/admin-files.md
- packages/concepts/session.md
- middleware/concepts/async-context-middleware.md
