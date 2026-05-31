<!-- Context: sse/core/lookup/commands | Priority: critical | Version: 1.0 | Updated: 2026-03-22 -->

# SSE Demo Commands

## Demo Server

```bash
cd demos/sse && pnpm start
# Runs on port 44100
```

## Typecheck

```bash
pnpm --filter <package> run typecheck
pnpm --filter sse-demo run typecheck
```

## Lint

```bash
pnpm run lint
pnpm run lint:fix  # Auto-fix
```

## Clean

```bash
pnpm run clean  # git clean -fdX
```

## Format

```bash
pnpm run format
pnpm run format:check
```

## Package Scripts

```bash
npm run build --workspace=remix-<package>
npm run test --workspace=remix-<package>
npm run typecheck --workspace=remix-<package>
```

## SSE Demo Specific

```bash
# Run SSE server
cd demos/sse && npx tsx server.ts

# Run tests
cd demos/sse && npx remix test
```

## 📂 Codebase References

**Demo Code**: `demos/sse/` - All SSE demo implementation files
