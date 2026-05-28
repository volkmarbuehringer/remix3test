<!-- Context: development/remix3/packages/concepts | Priority: high | Version: 1.0 | Updated: 2026-05-20 -->

# Concept: Form-Data Parsing

**Purpose**: Parse `FormData` and `URLSearchParams` with the same schema-driven parse/parseSafe flow using `remix/data-schema/form-data`.

**Key Points**:
- Works with both `FormData` and `URLSearchParams` — same API, same validation pipeline
- Uses `f.object({...})` as the root schema, then `parse()` / `parseSafe()` as usual
- Four entry kinds: `f.field()` (single text), `f.fields()` (repeated text), `f.file()` (single upload), `f.files()` (multiple uploads)
- File helpers (`f.file`/`f.files`) only work with `FormData`; `URLSearchParams` returns issues for blob fields
- Combine with `coerce.*` inside field schemas for string-to-type conversion

**Form-data schema shape** — `f.object({ key: f.field(schema) })`:
```ts
import * as f from 'remix/data-schema/form-data'
import * as coerce from 'remix/data-schema/coerce'
import { parse } from 'remix/data-schema'

let LoginSchema = f.object({
  email: f.field(coerce.string()),
  age: f.field(coerce.number()),
  bio: f.field(coerce.string()),
  tags: f.fields(coerce.string()),     // repeated values → string[]
  avatar: f.file(instanceof_(File)),   // single file
  attachments: f.files(any()),         // multiple files → Blob[]
})
```

**Parsing** — uses standard `parse()` / `parseSafe()`:
```ts
let form = new FormData()
form.set('email', 'ada@example.com')
form.set('age', '37')
form.append('tags', 'dev')
form.append('tags', 'docs')

let data = parse(LoginSchema, form)
// → { email: 'ada@example.com', age: 37, bio: undefined, tags: ['dev', 'docs'], avatar: undefined, attachments: [] }
```

**With URLSearchParams** — text-only fields; file/file fields produce issues:
```ts
let params = new URLSearchParams('email=ada@example.com&age=37')
let data = parse(LoginSchema, params)
```

**Coercion integration** — form data values are always strings (or Blobs). Use `coerce.*` to parse:
```ts
let Schema = f.object({
  count: f.field(coerce.number()),   // "37" → 37
  active: f.field(coerce.boolean()), // "true" → true
  date: f.field(coerce.date()),      // "2026-01-01" → Date
})
```

**Reference**: `~/remix/packages/data-schema/src/lib/form-data.ts`

**Related**: `concepts/data-schema.md`, `guides/extending-data-schema.md`
