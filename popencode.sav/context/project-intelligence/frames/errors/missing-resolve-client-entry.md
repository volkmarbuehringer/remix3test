<!-- Context: frames/errors/missing-resolve-client-entry | Priority: high | Version: 1.0 | Updated: 2026-04-29 -->

# resolveClientEntry Missing from renderFragment

**Symptom**: Client entries in fragments don't hydrate, pagination buttons don't work.

**Root Cause**: `renderFragment()` wasn't including `resolveClientEntry` in its SSR output, so client-side hydration couldn't find the entry points for interactive components.

```typescript
// ❌ BROKEN - No resolveClientEntry
function renderFragment(node, init) {
  let stream = renderToStream(node, {
    onError(error) { console.error(error) },
    // resolveClientEntry missing!
  })
  return new Response(stream, { ... })
}

// ✅ FIXED - Include resolveClientEntry
function renderFragment(node, init) {
  let stream = renderToStream(node, {
    resolveClientEntry: (src) => resolveClientEntry(router, src),
    onError(error) { console.error(error) },
  })
  return new Response(stream, { ... })
}

async function resolveClientEntry(router, src) {
  let url = new URL(src, 'file://localhost')
  let mod = await router.loadModule(url)
  return mod
}
```

**Affected Files**: `bookstore/app/utils/render.tsx`

## See Also

- `guides/nested-frames.md` - All required fixes
