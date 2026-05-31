# Concept: clientEntry Props Typing

**Core Idea**: When clientEntry components need complex state like SortState, pass individual primitive props instead of objects to avoid index signature requirements.

**Key Points**:

- clientEntry generic typing is strict with SerializableProps
- SortState objects fail type checking due to missing index signature
- Solution: pass `sortColumn?: string`, `sortDir?: 'asc' | 'desc'` instead
- Type assertion (`as any`) bypasses complex generics when needed
- Minimal props = fewer serialization issues

**Quick Example**:

```tsx
// ❌ SortState object prop
<AdminGrid sort={sort} />

// ✅ Individual primitive props
<AdminGrid sortColumn={sort.column} sortDir={sort.direction} />
```

**Reference**: `packages/component/src/lib/client-entries.ts`

**Related**: `development/remix3/errors/client-entry-props.md`
