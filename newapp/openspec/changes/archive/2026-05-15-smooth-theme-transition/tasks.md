## 1. Implementation

- [x] 1.1 Add `transition: background-color 150ms ease, color 150ms ease` to the `<body>` `mix` style block in `app/ui/document.tsx`
- [x] 1.2 Add a `<style>` tag in `<head>` with `@media (prefers-reduced-motion: reduce)` to disable body transitions for users who request reduced motion

## 2. Verification

- [x] 2.1 Run `pnpm run typecheck` to verify type correctness
- [x] 2.2 Run `pnpm test` to verify no test regressions
