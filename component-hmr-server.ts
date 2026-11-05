import { createRequire, registerHooks } from 'node:module'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { transformComponentsForServer } from 'remix/component-hmr'

/**
 * Server-side component HMR hook.
 *
 * Mirrors `remix/component-hmr/node`, but asks the transform for no source map.
 * The vendor hook forces `sourceMap: true`; its `source-map-js` pass adds a
 * mapping for every character of each setup hint and takes seconds per large
 * module, turning dev boot into a ~15s affair. Server stack traces are the only
 * consumer of that map; browser assets still get their maps from the asset
 * server's `componentHmr()` loader.
 */

const importPresets = [
  {
    importSource: 'remix',
    serverRuntimeSpecifier: 'remix/component-hmr/runtime/server',
  },
  {
    importSource: '@remix-run',
    serverRuntimeSpecifier: '@remix-run/component-hmr/runtime/server',
  },
] as const

type LoadResultLike = {
  format?: string | null | undefined
  source?: string | ArrayBuffer | ArrayBufferView | null | undefined
}

registerHooks({
  load(url, context, nextLoad) {
    let result = nextLoad(url, context)
    if (!shouldTransformModule(url, result)) return result

    let source = stripInlineSourceMap(
      typeof result.source === 'string' ? result.source : new TextDecoder().decode(result.source),
    )
    let importSource = detectImportSource(url)
    if (importSource === null) return result

    let transformed = transformComponentsForServer(source, {
      importSource,
      moduleUrl: canonicalUrl(url),
      sourceMap: false,
    })

    return transformed.transformed
      ? {
          ...result,
          format: result.format ?? context.format ?? 'module',
          source: transformed.code,
        }
      : result
  },
})

function shouldTransformModule(
  url: string,
  result: LoadResultLike,
): result is LoadResultLike & {
  source: string | ArrayBuffer | ArrayBufferView
} {
  if (!url.startsWith('file:')) return false
  if (url.includes('/node_modules/')) return false
  if (result.format !== undefined && result.format !== null && result.format !== 'module') {
    return false
  }
  return result.source !== undefined && result.source !== null
}

function stripInlineSourceMap(source: string): string {
  return source.replace(
    /(?:\/\/# sourceMappingURL=data:application\/json;base64,[A-Za-z0-9+/=]+|\/\*# sourceMappingURL=data:application\/json;base64,[A-Za-z0-9+/=]+ \*\/)\s*$/g,
    '',
  )
}

function canonicalUrl(url: string): string {
  let canonical = new URL(url)
  canonical.search = ''
  canonical.hash = ''
  return canonical.href
}

function detectImportSource(url: string): 'remix' | '@remix-run' | null {
  let filePath: string
  try {
    filePath = fileURLToPath(url)
  } catch {
    return null
  }

  let require = createRequire(filePath)
  let paths = [dirname(filePath)]
  for (let preset of importPresets) {
    try {
      require.resolve(preset.serverRuntimeSpecifier, { paths })
      return preset.importSource
    } catch {
      // Try the next import layout.
    }
  }
  return null
}
