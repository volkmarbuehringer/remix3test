<!-- Context: standards/ssr-client-scripts | Priority: high | Version: 1.0 | Updated: 2026-04-24 -->

# SSR & Client-Side Scroll Scripts

**Purpose**: Document lessons learned about managing scroll position in SSR contexts.

---

## Problem

Client-side scroll scripts behave unreliably in SSR contexts:

| Issue | Cause |
|-------|-------|
| Scripts run before DOM ready | SSR renders on server, no DOM present |
| No hydration coordination | Client hydration is async, timing unpredictable |
| Browser scroll restoration | Browsers restore scroll on back navigation |
| Race conditions | Multiple scroll sources conflict |

---

## Solutions (Priority Order)

### 1. Reverse Message Order — BEST

Render newest messages first using CSS. No client-side JS needed:

```typescript
{[...messages].reverse().map((msg) => (
  <Message key={msg.id} {...msg} />
))}
```

**Advantages**:
- Works without ANY client-side JavaScript
- Reliable for pre-loaded data
- No scroll script required

### 2. CSS-Only Solutions

When reverse order isn't possible:
- CSS `flex-direction: column-reverse` for chat containers
- Pure CSS solutions eliminate JS timing issues

### 3. Client-Side Scroll — Fallback Only

Use for form submissions (user-driven timing):

```javascript
requestAnimationFrame(function() {
  requestAnimationFrame(function() {
    container.scrollTop = 0;
  });
});
```

**Key points**:
- Double `requestAnimationFrame` ensures DOM is ready
- Scroll to TOP (not bottom) when newest messages at top
- Only for user-initiated actions

---

## Key Learning

| Scenario | Recommended |
|----------|-------------|
| Initial SSR render | Reverse order (no JS) |
| Pre-loaded data | Reverse order (no JS) |
| Form submission | Double rAF scroll |
| Dynamic content | CSS solutions |

**Principle**: No JS > complex JS. SSR should work without client-side scroll scripts.

---

## Reference Implementation

**Bookstore chat** — `bookstore/app/controllers/chat/page.tsx`:
- Line 321: `[...messages].reverse()` for SSR-compatible rendering
- Lines 388-395: Double rAF for form submission scroll

**Bookstore agent** — `bookstore/app/controllers/agent/page.tsx`:
- Line 433: Same reverse pattern
- Lines 520-535: Same double rAF pattern

---

## Related

- **Code Quality** → `code-quality.md` (SSR patterns)
- **Remix Patterns** → `../../development/remix3/`