---
name: remix-data-schema-optional-top-level
description: "Use s.optional(s.string()) not s.string().optional() in remix/data-schema"
user-invocable: false
origin: auto-extracted
---

# remix/data-schema: `.optional()` is a Top-Level Function

**Extracted:** 2026-07-03
**Context:** Adding optional fields to a validate schema using `remix/data-schema` produces a confusing TS error.

## Problem

When writing a schema with optional fields:

```ts
import * as s from 'remix/data-schema'

const mySchema = s.object({
  name: s.string().optional(),       // ❌ TS error
})
```

TypeScript reports:

```
Property 'optional' does not exist on type 'Schema<unknown, string>'
```

This is misleading — it suggests `.optional()` doesn't exist at all, when in fact it exists but as a **top-level function**, not a method on the schema object.

The same applies to `.nullable()`.

## Solution

Use `s.optional(...)` wrapping the schema expression, not `.optional()` as a method call:

```ts
import * as s from 'remix/data-schema'

const mySchema = s.object({
  name: s.optional(s.string()),       // ✅ Correct
  age: s.optional(s.number()),        // ✅
  tags: s.optional(s.array(s.string())),
})
```

Both `s.optional()` and `s.nullable()` are exported from `remix/data-schema` as standalone functions:

```ts
export { ..., optional, nullable, ... } from 'remix/data-schema'
```

## When to Use

- Writing a schema with `s.object({ ... })` that needs optional fields
- TypeScript error: `Property 'optional' does not exist on type 'Schema<...>'`
- Porting from Zod where `.optional()` is a method — Remix's `data-schema` requires the top-level wrapper
