<!-- Context: development/remix3/packages/concepts | Priority: high | Version: 1.2 | Updated: 2026-05-20 -->

# Concept: Data Schema

**Purpose**: Tiny, standards-aligned data validation. Standard Schema v1 compatible, sync-first, minimal API.

**Key Points**:
- Standard Schema v1 compatible (interops with Zod, Valibot, ArkType); sync-first, runtime agnostic
- Primitives: string, number, boolean, bigint, symbol, null_, undefined_, literal, any, instanceof_
- Collections: array, tuple, record, map, set; Modifiers: nullable, optional, defaulted, union, variant
- Coercion via `remix/data-schema/coerce`, form-data via `remix/data-schema/form-data`
- Chainable: `.pipe()`, `.refine()`, `.transform()`; Recursive via `remix/data-schema/lazy`

**parse() — success-or-throw**:
```ts
import { string, number, object, parse } from 'remix/data-schema'
import { email, minLength } from 'remix/data-schema/checks'
let User = object({ email: string().pipe(email()), username: string().pipe(minLength(3)), age: number() })
let user = parse(User, { email: 'ada@example.com', username: 'ada', age: 37 })
```

**parseSafe() — success-or-issues (no throw)**:
```ts
let result = parseSafe(User, input)
if (!result.success) { console.log(result.issues) }
```

**Type inference**:
```ts
import { InferInput, InferOutput } from 'remix/data-schema'
type In = InferInput<typeof User>; type Out = InferOutput<typeof User>
```

**Primitives & collections**:
```ts
string() | number() | boolean() | bigint() | symbol() | null_() | undefined_()
literal('admin') | any() | instanceof_(Date)
array(string()) | tuple([string(), number()]) | record(string(), number())
map(string(), number()) | set(number())
```

**Object** — accepts `{ unknownKeys: 'strip' (default) | 'passthrough' | 'error' }`:
```ts
object({ name: string(), age: number() })
object({ name: string() }, { unknownKeys: 'passthrough' })
```

**Modifiers**:
```ts
nullable(string())              // string | null
optional(string())              // string | undefined
defaulted(string(), 'fallback') // string, defaults to 'fallback'
enum_(['a', 'b', 'c'] as const) // 'a' | 'b' | 'c'
union([string(), number()])     // string | number
```

**Discriminated unions** (`variant(discriminator, { tag: schema })`):
```ts
let Shape = variant('kind', {
  circle: object({ radius: number() }),
  rect: object({ w: number(), h: number() }),
}) // validates `{ kind: 'circle', radius: 5 }`
```

**Checks** (`remix/data-schema/checks`): `min`, `max`, `email`, `url`, `minLength`, `maxLength`.

**Coerce** (`remix/data-schema/coerce`):
```ts
import * as coerce from 'remix/data-schema/coerce'
coerce.string() | coerce.number() | coerce.boolean() | coerce.bigint() | coerce.date()
```

**Form-data** (`remix/data-schema/form-data`):
```ts
import * as f from 'remix/data-schema/form-data'
f.object({ email: f.field(coerce.string()) })
```
➡ Full API: `concepts/form-data-parsing.md`

**Transforms** — `.transform(fn)` changes output type:
```ts
let Trim = string().transform(s => s.trim())
```

**Parse options — errorMap, abortEarly**:
```ts
parseSafe(Schema, input, { abortEarly: true, errorMap: (ctx) => '...' })
```

**Recursive schemas** (`remix/data-schema/lazy`):
```ts
import { lazy } from 'remix/data-schema/lazy'
let Node = object({ value: string(), children: optional(array(lazy(() => Node))) })
```

**Extension**: See `guides/extending-data-schema.md` for `createSchema()`, `createIssue()`, `fail()`.

**Reference**: `~/remix/packages/data-schema/src/lib/schema.ts`

**Related**: `concepts/form-data-parsing.md`, `guides/extending-data-schema.md`, `lookup/upstream-references.md`
