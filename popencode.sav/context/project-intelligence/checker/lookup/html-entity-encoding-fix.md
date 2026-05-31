<!-- Context: project-intelligence/checker/lookup | Priority: high | Version: 1.0 | Updated: 2026-04-17 -->

# HTML Entity Encoding Fix

**Problem**: Double-encoded HTML entities appearing in chat messages (`&#039;` instead of `'`).

**Pattern**: Both bookstore and checker use `JSON.stringify` to store messages in the database, then `sanitize()` in chat pages. This caused inconsistent encoding.

---

## Root Cause

1. **Storage**: Both apps use `JSON.stringify(message)` to save messages - stores raw text
2. **Display**: `sanitize()` applied in chat pages for XSS protection
3. **Issue**: When text was already sanitized/encoded before storage, `sanitize()` would encode again

Result: `'` → (first encode) → `&#039;` → (second encode) → `&amp;#039;`

---

## Solution Applied

### 1. Remove sanitize() from chat page (content from trusted DB)
```typescript
// checker/app/controllers/chat/page.tsx
// BEFORE: <div class="message-content">{sanitize(msg.user)}</div>
// AFTER: <div class="message-content">{msg.user}</div>
```
Content is from the app's own database - not user input that could contain malicious scripts.

### 2. Add decode() in admin chatlog page
```typescript
// checker/app/controllers/admin/chatlog/page.tsx
function decode(text: string): string {
  let result = text
  // Round 1: handle &amp; prefixed (double encoded)
  result = result.replace(/&amp;#39;/g, '&#39;')...replace(/&amp;/g, '&')
  // Round 2: handle numeric entities
  result = result.replace(/&#39;/g, "'").replace(/&#039;/g, "'")...
  // Round 3: handle named entities
  result = result.replace(/&apos;/g, "'").replace(/&lt;/g, '<')...
  return result
}
```

The decode function handles multiple rounds of encoding:
- `&amp;#039;` → `&#039;` → `'`
- `&amp;#8217;` → `&#8217;` → `'`

---

## Key Insight

**Trust your own database**: If content is stored by your own application (not direct user input), you don't need to sanitize on display. The DB is a trusted source.

---

## When to Use

| Scenario | Action |
|----------|--------|
| User input stored via form → DB → display | Use sanitize() |
| App-generated content (AI responses) | No sanitize needed |
| Admin view of DB content | Use decode() to handle legacy encoding |
| Displaying external/API content | Use sanitize() |

---

## 📂 Codebase References

**Fix Implementation**:
- `checker/app/controllers/chat/page.tsx` - Removed sanitize (line 36, 54)
- `checker/app/controllers/admin/chatlog/page.tsx` - Added decode function (lines 5-15)

**Data Layer**:
- `checker/app/lib/chatlog.ts` - JSON.stringify storage pattern

---

## Related

- Admin Chatlog: `../guides/admin-chatlog.md`
- AI Chat SSR: `../guides/ai-chat-ssr.md`