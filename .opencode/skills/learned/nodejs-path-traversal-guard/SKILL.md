---
name: nodejs-path-traversal-guard
description: "Correct path traversal guard using path.relative instead of startsWith"
user-invocable: false
origin: auto-extracted
---

# Node.js Path Traversal Guard with `path.relative`

**Extracted:** 2026-07-11
**Context:** Any Node.js application that restricts file system access to a project root directory (file servers, agent tools, template engines, archive extractors)

## Problem

Using `path.resolve(root, userPath).startsWith(root)` to detect traversal silently fails for sibling directories whose names share a prefix with the root:

```typescript
let root = '/home/project/my-app'
let resolved = path.resolve(root, '../my-app-leaks/.env')
// resolved = '/home/project/my-app-leaks/.env'
resolved.startsWith(root) // true — BUG! Outside the project root
```

Additionally, `path.resolve` does not resolve symlinks. A `node_modules/.bin/pkg` symlinked to `/etc` passes simple path checks.

## Solution

Use `path.relative` for the prefix check and `fs.realpathSync` for symlink resolution:

```typescript
import * as path from 'node:path'
import { realpathSync } from 'node:fs'
import * as fs from 'node:fs/promises'

// Call realpathSync ONCE at module load
let projectRoot = realpathSync(process.cwd())

function resolveSafe(subdir: string): { ok: true; resolved: string } | { ok: false; error: string } {
  // Use path.relative — not startsWith — to avoid prefix collisions
  let resolved = path.resolve(projectRoot, subdir)
  let rel = path.relative(projectRoot, resolved)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return { ok: false, error: 'Path traversal detected' }
  }
  return { ok: true, resolved }
}

// For read operations, also check symlinks
async function readFileSafely(filePath: string): Promise<{ content: string } | { error: string }> {
  let resolved = resolveSafe(filePath)
  if (!resolved.ok) return resolved

  try {
    let real = await fs.realpath(resolved.resolved)
    let relReal = path.relative(projectRoot, real)
    if (relReal.startsWith('..') || path.isAbsolute(relReal)) {
      return { error: 'Path traversal detected (symlink)' }
    }
    let content = await fs.readFile(real, 'utf-8')
    return { content }
  } catch (err) {
    return { error: String(err) }
  }
}
```

## When to Use

- Adding file-listing or file-reading tools to an agent
- Building an admin file browser or template editor
- Any endpoint that takes a user-controlled path to access the filesystem
- Code review: flag any `path.resolve(x, y).startsWith(x)` as a probable vulnerability
