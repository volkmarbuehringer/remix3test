## Context

The remix monorepo upstream recently enabled `"erasableSyntaxOnly": true` across all 91+ `tsconfig.json` files as part of a TypeScript configuration modernization (commit `870e8ea6a`). Newapp's `tsconfig.json` currently lacks this option.

`erasableSyntaxOnly` is a TypeScript 5.8+ compiler option that disallows syntax requiring runtime transformation:
- `enum` declarations (use `const enum` or union types instead)
- `namespace` / `module` (use ES modules instead)
- Parameter properties (`constructor(public x: number)`)
- Legacy decorators (`@decorator` syntax)

Since newapp uses none of these patterns, adding this option is purely a forward-guard — it prevents regression if someone introduces such syntax in the future.

## Goals / Non-Goals

**Goals:**
- Align newapp's TypeScript configuration with upstream remix conventions
- Prevent accidental introduction of syntax that requires runtime transformation
- No behavioral changes to the application

**Non-Goals:**
- No changes to existing source code
- No changes to other tsconfig files (demos, tools, etc.)
- No linting rule additions or dependency updates

## Decisions

**Decision: Add `erasableSyntaxOnly` as a standalone compiler option**

- `erasableSyntaxOnly` is a TypeScript 5.8+ feature. TypeScript version is tracked via `@typescript/native-preview 7.0.0-dev` which ships with TS 7 preview — well above the required version.
- No other tsconfig changes needed. The option is self-contained and doesn't interact with existing settings like `verbatimModuleSyntax` or `jsx`.
- Placed alongside `verbatimModuleSyntax` in the compilerOptions block for logical grouping of TypeScript strictness settings.

**Alternatives considered:**
- *Adding `noImplicitOverride` or other strictness flags* — Out of scope; this change is specifically about upstream alignment
- *Using ESLint rules instead* — Redundant; `erasableSyntaxOnly` is a compiler-level check with zero configuration overhead

## Risks / Trade-offs

- **[Low] Minor friction for contributors** — If someone is accustomed to using enums or parameter properties, they'll get a compile error. Mitigation: union types and plain class field initialization are idiomatic TypeScript replacements.
- **[None] Zero runtime risk** — This is a compile-time only restriction. It does not affect emitted code or runtime behavior.
