import { createAssetServer } from 'remix/assets'
import { uiHmr } from 'remix/ui-hmr/browser-module-hooks'

const rootDir = process.cwd()
const isDevelopment = process.env.NODE_ENV === 'development'

export const assetServer = createAssetServer({
  basePath: '/assets',
  rootDir,
  fileMap: {
    'app/*path': 'app/*path',
    'node_modules/*path': 'node_modules/*path',
  },
  allowFiles: [
    'app/**/*.browser.*',
    'app/assets/entry.tsx',
    'app/routes.ts',
    'app/ui/**',
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
    moduleHooks: isDevelopment ? [uiHmr()] : undefined,
  },
  hmr: isDevelopment
    ? async () => (await import('remix/node-hmr/runtime')).createBrowserHmrChannel()
    : undefined,
  watch: isDevelopment,
  minify: true,
})
