import { createAssetServer } from 'remix/assets'
import { loadConfig } from 'remix/cli'
import { uiHmr } from 'remix/ui-hmr/assets'

const isDevelopment = process.env.NODE_ENV === 'development'
const isHmr = Boolean(isDevelopment && process.env.REMIX_NODE_HMR)

const config = await loadConfig(import.meta.dirname)
if (config.assets === undefined) {
  throw new Error('Missing assets configuration in remix.json')
}

export const assetServer = createAssetServer({
  ...config.assets,
  watch: isDevelopment,
  hmr: isHmr
    ? async () => (await import('remix/node-hmr/runtime')).createBrowserHmrChannel()
    : undefined,
  fingerprint: !isDevelopment
    ? { buildId: process.env.BUILD_ID ?? `dev-${process.pid}-${Date.now()}` }
    : undefined,
  target: { es: '2022', chrome: '109', safari: '16.4' },
  sourceMaps: isDevelopment ? 'external' : undefined,
  scripts: {
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
    },
    loaders: isHmr ? [uiHmr()] : undefined,
  },
  minify: !isDevelopment,
})
