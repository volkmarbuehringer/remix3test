---
name: remix3-fragment-scroll-overflow-container
description: "Browser-native #hash fragment scrolling inside overflow-y:auto containers for Remix 3 frame scroll-to-bottom"
user-invocable: false
origin: auto-extracted
---

# Remix 3: Fragment Scrolling Inside Overflow Containers

**Extracted:** 2026-07-06
**Context:** A Remix 3 chat page needed to scroll the message container to the bottom after POST+redirect, but inline `<script>` tags don't execute in frame navigation because content is fetched via `router.fetch()` and injected into the DOM.

## Problem

Remix 3 frame navigation fetches HTML via `router.fetch()` and injects it into the DOM. Inline `<script>` tags in frame responses **do not execute**. This blocks client-side scroll-to-bottom patterns like:

```html
<script>document.getElementById('chat-messages').scrollTop = ...</script>
```

Using `clientEntry` from `remix/ui` works but adds complexity — a separate file, async hydration, and lifecycle management with `requestAnimationFrame`.

## Solution

Place a `<div id="your-target" />` **inside** the scrollable overflow container (`overflow-y: auto`), then navigate to the URL with `#your-target` hash.

The browser's native fragment scrolling doesn't just scroll `<html>` — it finds the **nearest scrollable ancestor** of the target element and scrolls THAT container to make the target visible.

### Example

```tsx
// ❌ Broken in frame navigation: inline script never fires
<div id="chat-messages" mix={conversationStyle}>
  {messages.map(msg => <div>{msg}</div>)}
</div>
<div id="chat-end" />
<script>document.getElementById('chat-messages').scrollTop = ...</script>

// ✅ Works: fragment scrolls the overflow container natively
<div id="chat-messages" mix={conversationStyle}>
  {messages.map(msg => <div>{msg}</div>)}
  <div id="chat-end" />  {/* ← inside the scrollable container */}
</div>
```

Then include the hash in navigation URLs:

```ts
// On success POST redirect
let url = routes.chat.index.href() + '?threadId=' + id + '#chat-end'
return redirect(url)

// On links to existing conversations
let link = routes.chat.index.href() + '?threadId=' + id + '#chat-end'
```

### How It Works

1. Browser parses the URL hash (`#chat-end`)
2. Finds the element with matching `id`
3. Walks up the DOM tree to find the first ancestor with `overflow: auto` or `overflow: scroll`
4. Scrolls that ancestor to make the target element visible (at the bottom if it's the last child)

### Required CSS on the container

```css
overflow-y: auto;   /* makes the div a scroll container */
/* or */
overflow-y: scroll;  /* always shows scrollbar */
```

### When to Use

- A Remix 3 chat/message page needs scroll-to-bottom after form submission
- Inline `<script>` tags don't work (frame navigation, content injection)
- You want scroll-to-bottom without a `clientEntry` component
- Fragment scrolling already works for page-level anchors but fails for elements inside scrollable divs
