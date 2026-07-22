import { createAssetServer } from 'remix/assets'

const rootDir = process.cwd()

export const assetServer = createAssetServer({
  basePath: '/assets',
  rootDir,
  fileMap: {
    'app/*path': 'app/*path',
    'node_modules/*path': 'node_modules/*path',
  },
  allowFiles: ['app/assets/**', 'app/routes.ts', 'app/ui/**', 'app/utils/**'],
  allowPackages: ['remix'],
  denyFiles: ['app/**/*.server.*'],
  target: { es: '2022', chrome: '109', safari: '16.4' },
  sourceMaps: process.env.NODE_ENV === 'development' ? 'external' : undefined,
  scripts: {
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
    },
  },
  minify: true,
})
