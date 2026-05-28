<!-- Context: standards/code | Priority: critical | Version: 2.5 | Updated: 2026-05-03 -->

# Code Standards

**Core Concept**: Remix 3 code standards — pure functions, immutability, explicit dependencies, and `css()` mixins for styling. No React patterns (hooks, synthetic events, automatic re-rendering).

## ⚠️ Framework Notice (Remix 3 — NOT React)

| Aspect | React (DON'T) | remix/ui (DO) |
|--------|---------------|---------------|
| State | `useState`, hooks | Plain JS vars, `handle.update()` |
| Updates | Auto re-render | Explicit `handle.update()` |
| Events | Synthetic events | Real DOM events via `on()` |
| Hydration | `hydrateRoot` | `clientEntry` + `run()` |

```javascript
// ❌ React: const [count, setCount] = useState(0); useEffect(() => {}, [])
// ✅ remix/ui: let count = 0; <button onClick={() => { count++; handle.update() }}>{count}</button>
```

**Do NOT apply React patterns** (hooks, memoization, synthetic events).

---

## ⚡ CSS/Styling (MANDATORY)

**All styling uses `css()` mixins from `remix/ui`**. Never use inline `<style>` or `className`.

```typescript
import { css } from 'remix/ui'
const style = css({ padding: '0.75rem', '&:hover': { opacity: 0.8 } })
// ✅ <button mix={style}>Click</button>
// ❌ <button className="btn"> or <style>{`.btn{}`}</style>
```

**Why**: Mixins enable SSR-compatible styling with hover states. className requires client hydration.

---

## Key Points

- **Modular**: Small focused components (<50 lines ideal, <100 max)
- **Functional**: Pure functions, immutability, composition
- **Declarative**: Describe what, not how
- **Explicit deps**: Dependency injection over direct imports
- **Use `.ts` extensions** in all imports
- **Error handling**: Validate at boundaries, explicit error returns
- **Avoid**: Mutation, global state, `var`, `as any`, magic numbers

## Quick Example

```javascript
// ✅ Pure function
const addItem = (items, item) => [...items, item]
// ✅ Composition
const processUser = pipe(validateUser, enrichUserData, saveUser)
// ✅ Explicit dependencies
function createService(db, log) {
  return { create: (data) => log('creating', db.insert(data)) }
}
```

**Reference**: See also `test-coverage.md`, `documentation.md`
