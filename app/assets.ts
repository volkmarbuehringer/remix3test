import { createAssetServer } from 'remix/assets'
import { uiHmr } from 'remix/ui-hmr/assets'

const rootDir = process.cwd()
const isDevelopment = process.env.NODE_ENV === 'development'
const isHmr = Boolean(isDevelopment && process.env.REMIX_NODE_HMR)

export const assetServer = createAssetServer({
  basePath: '/assets',
  rootDir,
  watch: isDevelopment,
  hmr: isHmr
    ? async () => (await import('remix/node-hmr/runtime')).createBrowserHmrChannel()
    : undefined,
  fingerprint: !isDevelopment
    ? { buildId: process.env.BUILD_ID ?? `dev-${process.pid}-${Date.now()}` }
    : undefined,
  fileMap: {
    'app/*path': 'app/*path',
    'node_modules/*path': 'node_modules/*path',
  },
  allowFiles: [
    'app/**/public/**',
    'app/ui/**',
    'app/assets/entry.tsx',
    'app/assets/frame-response.browser.tsx',
    'app/assets/error-card.browser.tsx',
    'app/routes.ts',
    'app/utils/**',
  ],
  allowPackages: ['remix'],
  denyFiles: ['app/**/*.server.*'],
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
