import * as fs from 'node:fs'
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'

import type { Handle, RemixNode } from 'remix/component'

import { isDevelopmentEnv } from '../../config.ts'

const UI_ROOT = path.resolve(import.meta.dirname, '../../ui')
const DEMO_FILE_PATTERN = /\.demo\.(tsx|ts)$/
const DEFAULT_GROUP = 'Allgemein'
const DISCOVERY_CACHE_MS = 500

let discoveryCache: { at: number; demos: DemoFile[] } | undefined

type DemoLayout = 'center'

/**
 * A server-renderable demo module under `app/ui/`.
 *
 * Demo files are discovered at request time so adding a file needs no registry
 * edit. The default export must be a component function that is safe to render
 * on the server; browser-only behavior belongs inside a client entry used by
 * the demo, not at module scope.
 */
export type DemoFile = {
  absolutePath: string
  description?: string
  filename: string
  group: string
  layout?: DemoLayout
  order?: number
  title: string
}

export type DemoComponent = (handle: Handle) => () => RemixNode

/** Every `*.demo.tsx` / `*.demo.ts` under `app/ui/`, grouped for the index. */
export function discoverDemoFiles(): DemoFile[] {
  if (!isDevelopmentEnv()) return discoverDemoFilesUncached()

  // Development only: a short cache keeps the synchronous walk/read off the
  // event loop for back-to-back requests while still picking up new files
  // quickly. Tests and production always recompute.
  let now = Date.now()
  if (discoveryCache !== undefined && now - discoveryCache.at < DISCOVERY_CACHE_MS) {
    return discoveryCache.demos
  }

  let demos = discoverDemoFilesUncached()
  discoveryCache = { at: now, demos }
  return demos
}

function discoverDemoFilesUncached(): DemoFile[] {
  return walkDemoFiles(UI_ROOT).map(createDemoFile).toSorted(compareDemoFiles)
}

/** Resolves a route param to a discovered demo, rejecting traversal attempts. */
export function findDemoFile(filename: string): DemoFile | undefined {
  let normalized = normalizeFilename(filename)
  if (normalized === undefined) return undefined

  return discoverDemoFiles().find((demo) => demo.filename === normalized)
}

/** The mtime-based cache key used by the server-side demo import. */
export function getDemoVersion(demo: DemoFile): string {
  return fs.statSync(demo.absolutePath).mtimeMs.toString(36)
}

/** Imports the demo module server-side; the asset server compiles the same file. */
export async function loadDemoModule(demo: DemoFile): Promise<DemoComponent> {
  let version = getDemoVersion(demo)
  // The mtime query creates a fresh module instance per edit. This is a
  // dev-only convenience; don't copy it into production request paths.
  let module = (await import(`${pathToFileURL(demo.absolutePath).href}?v=${version}`)) as {
    default?: unknown
  }

  if (typeof module.default !== 'function') {
    throw new Error(`Demo "${demo.filename}" must default export a component function`)
  }

  return module.default as DemoComponent
}

function createDemoFile(absolutePath: string): DemoFile {
  let filename = toPosixPath(path.relative(UI_ROOT, absolutePath))
  let metadata = readDemoMetadata(fs.readFileSync(absolutePath, 'utf8'))
  let directory = path.posix.dirname(filename)
  let demo: DemoFile = {
    absolutePath,
    filename,
    group: directory === '.' ? DEFAULT_GROUP : humanize(directory.split('/')[0] ?? ''),
    title: metadata.name ?? humanize(path.posix.basename(filename).replace(DEMO_FILE_PATTERN, '')),
  }

  if (metadata.description !== undefined) demo.description = metadata.description
  if (metadata.layout !== undefined) demo.layout = metadata.layout
  if (metadata.order !== undefined) demo.order = metadata.order

  return demo
}

function compareDemoFiles(left: DemoFile, right: DemoFile): number {
  let groupCompare = left.group.localeCompare(right.group)
  if (groupCompare !== 0) return groupCompare

  let leftOrder = left.order ?? Number.MAX_SAFE_INTEGER
  let rightOrder = right.order ?? Number.MAX_SAFE_INTEGER
  if (leftOrder !== rightOrder) return leftOrder - rightOrder

  return left.title.localeCompare(right.title)
}

function normalizeFilename(filename: string): string | undefined {
  let decoded: string
  try {
    decoded = decodeURIComponent(filename)
  } catch {
    return undefined
  }

  if (decoded.includes('\\')) return undefined

  let normalized = path.posix.normalize(decoded)
  if (
    path.posix.isAbsolute(normalized) ||
    normalized === '.' ||
    normalized.startsWith('../') ||
    normalized.includes('/../') ||
    normalized.includes('.server.') ||
    !DEMO_FILE_PATTERN.test(normalized)
  ) {
    return undefined
  }

  return normalized
}

function readDemoMetadata(source: string): {
  description?: string
  layout?: DemoLayout
  name?: string
  order?: number
} {
  let comment = source.match(/\/\*\*([\s\S]*?)\*\//)?.[1] ?? ''
  let metadata: {
    description?: string
    layout?: DemoLayout
    name?: string
    order?: number
  } = {}

  for (let key of ['description', 'layout', 'name', 'order'] as const) {
    let value = comment.match(new RegExp(`@${key}\\s+([^\\n]+)`))?.[1]?.trim()
    if (value === undefined || value.length === 0) continue

    if (key === 'order') {
      let order = Number(value)
      if (Number.isFinite(order)) metadata.order = order
      continue
    }

    if (key === 'layout') {
      if (value === 'center') metadata.layout = 'center'
      continue
    }

    if (key === 'description') {
      metadata.description = value
      continue
    }

    metadata.name = value
  }

  return metadata
}

function humanize(value: string): string {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function shouldIgnoreEntry(name: string): boolean {
  return name === 'node_modules' || name === 'build' || name === 'public' || name.startsWith('.')
}

function toPosixPath(value: string): string {
  return value.split(path.sep).join('/')
}

function walkDemoFiles(directory: string): string[] {
  let files: string[] = []

  if (!fs.existsSync(directory)) return files

  for (let entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (shouldIgnoreEntry(entry.name)) continue

    let absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkDemoFiles(absolutePath))
      continue
    }

    if (entry.isFile() && DEMO_FILE_PATTERN.test(entry.name) && !entry.name.includes('.server.')) {
      files.push(absolutePath)
    }
  }

  return files
}
