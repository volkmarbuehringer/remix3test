import * as path from 'node:path'

import { createContextKey, type Middleware } from 'remix/router'
import { getContext } from 'remix/middleware/async-context'

import { assetServer } from '../assets.ts'

export interface AssetEntry {
  scriptSrc: string
  scriptPreloads: string[]
}

const assetsEntryKey = createContextKey<AssetEntry>()
const defaultScriptEntry = path.resolve(import.meta.dirname, '../assets/entry.tsx')

export function loadAssetEntry(
  scriptEntry: string = defaultScriptEntry,
): Middleware<{ key: typeof assetsEntryKey; value: AssetEntry }> {
  return async (context, next) => {
    let [scriptSrc, scriptPreloads] = await Promise.all([
      assetServer.getHref(scriptEntry),
      assetServer.getPreloads(scriptEntry).catch(() => [] as string[]),
    ])

    context.set(assetsEntryKey, {
      scriptSrc,
      scriptPreloads,
    })

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
