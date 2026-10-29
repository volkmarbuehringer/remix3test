import { createAssetServer } from 'remix/assets'
import { loadConfig } from 'remix/cli'
import { componentHmr } from 'remix/component-hmr/assets'

import { envBool, isDevelopment, nodeEnv } from './config.ts'

const isHmr = isDevelopment && envBool('REMIX_NODE_HMR')

const config = await loadConfig(import.meta.dirname)
if (config.assets === undefined) {
  throw new Error('Missing assets configuration in remix.json')
}

export const assetServer = createAssetServer({
  ...config.assets,
  watch: isDevelopment,
  ...(isHmr
    ? {
        hmr: {
          channel: async () => (await import('remix/node-hmr/runtime')).createBrowserHmrChannel(),
          // HMR appends import-map deltas for updated modules; browsers without
          // native multiple-import-map support need the same polyfill the app
          // entry uses for client-entry preloads.
          moduleImporter: 'remix/multiple-import-maps-polyfill',
        },
      }
    : {}),
  ...(isDevelopment ? {} : { fingerprint: true }),
  target: { es: '2022', chrome: '109', safari: '16.4' },
  ...(isDevelopment ? { sourceMaps: 'external' } : {}),
  scripts: {
    define: {
      'process.env.NODE_ENV': JSON.stringify(nodeEnv),
    },
    ...(isHmr ? { loaders: [componentHmr()] } : {}),
  },
  minify: !isDevelopment,
})
