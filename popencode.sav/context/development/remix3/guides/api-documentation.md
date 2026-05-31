<!-- Context: development/remix3/guides/api-documentation | Priority: medium | Version: 1.0 | Updated: 2026-03-24 -->

# API Documentation Patterns

How to write JSDoc for public APIs in Remix packages.

## Core Concept

Document only the public API surface that users can import from package exports. Work from `package.json` exports → `src/` entry files → `src/lib/` implementations.

## Key Points

- Start with `package.json` exports, not `src/lib/`
- Document only public declarations reachable from package exports
- Add JSDoc to functions, classes, interfaces, type aliases
- Property-level JSDoc for every interface property
- Run `pnpm run lint` to verify JSDoc rules pass

## JSDoc Style

```ts
/**
 * Creates an AuthProvider for credentials-based authentication.
 *
 * @param options Parsing and verification hooks for submitted credentials.
 * @returns A provider that can be passed to `createAuthLoginRequestHandler()`.
 */
export function createCredentialsAuthProvider(options: CredentialsOptions) {}
```

## What to Document

| Declaration                    | Document?                   |
| ------------------------------ | --------------------------- |
| Exported functions             | ✅ Yes                      |
| Exported classes               | ✅ Yes                      |
| Exported interfaces            | ✅ Yes (with property docs) |
| Type aliases                   | ✅ If public object shape   |
| Internal helpers in `src/lib/` | ❌ No                       |

## ESLint Rules

- `jsdoc/require-param` - All params documented
- `jsdoc/require-returns` - Return values documented
- `jsdoc/no-types` - No JSDoc type syntax (TypeScript is source of truth)
- `jsdoc/check-alignment` - Clean formatting

## Checklist

- [ ] Started from `package.json` exports
- [ ] All public functions have `@param` and `@returns`
- [ ] All interface properties have property-level JSDoc
- [ ] No internal helpers documented
- [ ] `pnpm run lint` passes

## Good vs Bad

```ts
// Good - concise, user-facing
/**
 * @param options Parsing and verification hooks
 * @returns A provider for auth handler
 */

// Bad - redundant types in JSDoc
/**
 * @param {CredentialsAuthProviderOptions} options - options
 * @returns {CredentialsAuthProvider}
 */
```

## 📂 Codebase References

- `.agents/skills/write-api-docs/SKILL.md` - Full skill guide
- `packages/fetch-router/src/index.ts` - Example public exports

## Related

- `guides/readme-style.md` - README conventions
- `guides/monorepo-packages.md` - Package structure
