<!-- Context: development/remix3/lookup | Priority: medium | Version: 1.0 | Updated: 2026-04-11 -->

# Chat Log ARIA Attributes

**Purpose**: ARIA attributes for dynamic chat interfaces with live regions.

---

## Core Attributes

| Attribute | Value | Purpose |
|-----------|-------|---------|
| `role="log"` | - | Live region for log/chat messages |
| `aria-live="polite"` | - | Announces updates when user is idle |
| `aria-label` | string | Describes the region for screen readers |

---

## Implementation

```tsx
<ul
  role="log"
  aria-live="polite"
  aria-label="Chat messages"
>
  {messages.map(msg => (
    <li
      key={msg.id}
      style={{
        background: msg.role === 'user' ? '#e3f2fd' : '#f5f5f5',
        borderLeft: msg.role === 'user' ? '3px solid #2196f3' : '3px solid #4caf50',
      }}
    >
      {msg.content}
    </li>
  ))}
</ul>
```

---

## Color Coding

| Type | Background | Border | Text |
|------|-----------|--------|------|
| User | `#e3f2fd` (blue) | `#2196f3` (blue) | `#1976d2` |
| Assistant | `#f5f5f5` (gray) | `#4caf50` (green) | `#2e7d32` |
| Error | `#ffebee` (red) | `#f44336` (red) | `#c62828` |

---

## Related

- `../guides/client-component-accessibility.md` - General ARIA patterns
- `../concepts/client-side-chat-log.md` - Chat log pattern
