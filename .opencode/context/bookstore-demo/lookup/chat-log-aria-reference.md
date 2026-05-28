<!-- Context: bookstore-demo/lookup | Priority: medium | Version: 1.0 | Updated: 2026-04-11 -->

# Chat Log ARIA Attributes Quick Reference

**Purpose**: Quick reference for ARIA attributes used in dynamic chat interfaces.

---

## Core Attributes

| Attribute | Value | Purpose |
|-----------|-------|---------|
| `role="log"` | - | Indicates a live region for log/chat messages |
| `aria-live="polite"` | - | Announces updates when user is idle |
| `aria-label="Chat messages"` | string | Describes the region for screen readers |
| `aria-atomic="true"` | - | Announces entire region on update (optional) |

---

## Message Styling with ARIA

```tsx
// Container with live region
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
        borderLeft: msg.role === 'user'
          ? '3px solid #2196f3'
          : '3px solid #4caf50',
      }}
    >
      <span style={{ color: msg.role === 'user' ? '#1976d2' : '#2e7d32' }}>
        {msg.role === 'user' ? 'You' : 'Assistant'}
      </span>
      <div>{msg.content}</div>
    </li>
  ))}
</ul>
```

---

## Color Coding

| Type | Background | Border | Text |
|------|-----------|--------|------|
| User | `#e3f2fd` (light blue) | `#2196f3` (blue) | `#1976d2` (dark blue) |
| Assistant | `#f5f5f5` (gray) | `#4caf50` (green) | `#2e7d32` (dark green) |
| Error | `#ffebee` (light red) | `#f44336` (red) | `#c62828` (dark red) |

---

## Loading State

```tsx
{isLoading && (
  <div aria-live="polite">
    Assistant is thinking...
  </div>
)}
```

---

## Codebase References

**Implementation**:
- `bookstore/app/assets/assistant-chat.tsx` - Full ARIA implementation
- `bookstore/app/controllers/assistant/page.tsx` - Page container

**Related**:
- `../development/remix3/guides/client-component-accessibility.md` - ARIA patterns
- `concepts/chat-log-pattern.md` - Chat log concept

---

## Related

- `concepts/chat-log-pattern.md` - Chat log implementation
- `guides/client-side-form-handling.md` - Form handling
- `../development/remix3/guides/client-component-accessibility.md` - General ARIA
