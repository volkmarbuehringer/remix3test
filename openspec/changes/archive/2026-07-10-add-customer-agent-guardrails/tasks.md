## 1. Add input processors to customer agent

- [x] 1.1 Import all four processors in `app/actions/mastra/agents/customer-agent.ts`: `UnicodeNormalizer`, `RegexFilterProcessor`, `TokenLimiterProcessor`, `CostGuardProcessor` from `@mastra/core/processors`
- [x] 1.2 Add `inputProcessors` array to the Agent constructor with the four processors in order: UnicodeNormalizer, RegexFilterProcessor, TokenLimiterProcessor, CostGuardProcessor
- [x] 1.3 Configure UnicodeNormalizer with `stripControlChars: true`, `collapseWhitespace: true`, `trim: true`
- [x] 1.4 Configure RegexFilterProcessor with `presets: ['pii', 'secrets', 'urls']`, `strategy: 'block'`
- [x] 1.5 Configure TokenLimiterProcessor with `{ limit: 10000 }` (applied per-step automatically)
- [x] 1.6 Configure CostGuardProcessor with `maxCost: 0.50`, `scope: 'resource'`, `window: '24h'`, `strategy: 'block'`

## 2. Verify

- [x] 2.1 Run `npm run typecheck` and fix any type errors
- [x] 2.2 Run `npm test` and verify existing tests pass
