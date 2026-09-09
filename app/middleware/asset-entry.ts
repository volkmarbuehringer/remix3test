import * as path from 'node:path'

import { createContextKey, type Middleware } from 'remix/router'
import { getContext } from 'remix/middleware/async-context'
import type { ScriptEntry } from 'remix/assets'

import { assetServer } from '../assets.ts'

export type AssetEntry = ScriptEntry

const assetsEntryKey = createContextKey<AssetEntry>()
const defaultScriptEntry = path.resolve(import.meta.dirname, '../assets/entry.tsx')

export function loadAssetEntry(
  scriptEntry: string = defaultScriptEntry,
): Middleware<{ key: typeof assetsEntryKey; value: AssetEntry }> {
  return async (context, next) => {
    if (!context.request.headers.get('X-Remix-Frame')) {
      let entry = await assetServer.getScriptEntry(scriptEntry).catch(() => undefined)
      if (entry) context.set(assetsEntryKey, entry)
    }

    return next()
  }
}

export function getAssetEntry(): AssetEntry | undefined {
  try {
    return getContext().get(assetsEntryKey)
  } catch {
    return undefined
  }
}
