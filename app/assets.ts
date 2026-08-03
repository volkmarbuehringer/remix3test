import { createAssetServer } from 'remix/assets'

const rootDir = process.cwd()
const isDevelopment = process.env.NODE_ENV === 'development'

export const assetServer = createAssetServer({
  basePath: '/assets',
  rootDir,
  watch: false,
  fingerprint: {
    buildId: process.env.BUILD_ID ?? `dev-${process.pid}-${Date.now()}`,
  },
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
  },
  minify: true,
})
