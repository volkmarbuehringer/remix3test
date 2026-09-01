import { defineConfig } from 'oxfmt'

export default defineConfig({
  printWidth: 100,
  semi: false,
  singleQuote: true,
  useTabs: false,
   sortPackageJson: false,
  ignorePatterns: ['node_modules/', '.mastra/', '.opencode/', 'openspec/', '.claude/', '.agents/'],
})

