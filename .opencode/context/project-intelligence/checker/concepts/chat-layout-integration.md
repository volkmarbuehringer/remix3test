<!-- Context: project-intelligence/checker/concepts | Priority: high | Version: 1.0 | Updated: 2026-04-17 -->

# Chat UI Layout Integration

**Core**: SSR-first chat UI integration with Remix Layout component using progressive enhancement.

**Updated**: 2026-04-17

---

## Key Patterns

- **SSR-First**: Full HTML on initial load, minimal JS enhances after
- **Layout Integration**: Use height constraints, NOT `position: fixed`
- **Inline Scripts**: Small scripts embedded for immediate execution
- **Data Attributes**: `data-*` for JS targeting (e.g., `data-last-message`)

---

## Layout (Replace Fixed)

```css
/* BAD - breaks out of Layout */
.chat-wrapper { position: fixed; }

/* GOOD - fits within Layout */
.chat-wrapper {
  height: calc(100vh - 200px);
  min-height: 500px;
  max-height: 800px;
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  border: 1px solid #e2e8f0;
}
```

---

## Auto-Scroll (SSR + Inline Script)

```tsx
// Data attribute on last message
{messages.map((msg, i) => (
  <div {...(i === messages.length - 1 ? {'data-last-message':'true'} : {})} />
))}

// Inline script for scrolling
<script>{`
  (function() {
    var last = document.querySelector('[data-last-message]');
    if (last) last.scrollIntoView({behavior:'smooth', block:'end'});
  })();
`}</script>
```

---

## Loading State (CSS + Inline Handler)

```css
.send-button.is-loading { opacity: 0.7; cursor: wait; }
.send-button.is-loading svg { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
```

```tsx
<script data-loading-indicator>{`
  document.getElementById('chat-form').addEventListener('submit', function() {
    var btn = this.querySelector('.send-button');
    btn.disabled = true;
    btn.classList.add('is-loading');
  });
`}</script>
```

---

## CSS Variables

```css
.chat-wrapper {
  --bg-primary: #ffffff;
  --accent-primary: #6366f1;
  /* scoped theming */
}
```

---

## 📂 Codebase References

- `checker/app/controllers/chat/page.tsx` - Chat page implementation
- `checker/app/controllers/ui/layout.tsx` - Layout component