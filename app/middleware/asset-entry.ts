import * as path from 'node:path'

import { createContextKey, type Middleware } from 'remix/router'
import { getContext } from 'remix/middleware/async-context'
import { Logger } from 'remix/middleware/logger'
import type { ScriptEntry } from 'remix/assets'

import { assetServer } from '../assets.ts'

type AssetEntry = ScriptEntry

const assetsEntryKey = createContextKey<AssetEntry>()
const defaultScriptEntry = path.resolve(import.meta.dirname, '../assets/entry.tsx')

export function loadAssetEntry(
  scriptEntry: string = defaultScriptEntry,
): Middleware<{ key: typeof assetsEntryKey; value: AssetEntry }> {
  return async (context, next) => {
    let entryError: Error | undefined

    if (context.request.headers.get('X-Remix-Frame') !== 'true') {
      let entry = await assetServer.getScriptEntry(scriptEntry).catch((error: unknown) => {
        entryError = toError(error)
        return undefined
      })
      if (entry) context.set(assetsEntryKey, entry)
    }

    let response = await next()

    if (entryError) {
      if (isHtmlResponse(response)) {
        // A document rendered without the entry has no import map or client
        // runtime (hydration and frames never start). Fail loudly instead of
        // serving a dead page; JSON/API responses still work without the entry.
        throw entryError
      }
      context.get(Logger)?.(`Failed to load the client entry ${scriptEntry}: ${entryError.message}`)
    }

    return response
  }
}

function isHtmlResponse(response: Response): boolean {
  return response.headers.get('Content-Type')?.toLowerCase().includes('text/html') ?? false
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

export function getAssetEntry(): AssetEntry | undefined {
  try {
    return getContext().get(assetsEntryKey)
  } catch {
    return undefined
  }
}
