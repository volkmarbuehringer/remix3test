# Error: clientEntry Props Index Signature Required

**Core Idea**: clientEntry props must conform to `SerializableProps` which requires a `[key: string]: SerializableValue` index signature. Objects without this signature fail type checking.

**Key Points**:

- `SerializableProps = { [K in string]: SerializableValue }`
- `SortState` lacks index signature → cannot be passed as prop
- Objects without index sig break at type boundary
- Use primitives or add `[key: string]: any` to interfaces

**Quick Example**:

```typescript
// ❌ SortState - no index signature
interface SortState {
  column: string | null
  direction: 'asc' | 'desc'
}

// ✅ With index signature
interface SortState {
  [key: string]: any
  column?: string
  direction?: 'asc' | 'desc'
}
```

**Reference**: `packages/component/src/lib/client-entries.ts`

**Related**: `development/remix3/concepts/client-entry-typing.md`
