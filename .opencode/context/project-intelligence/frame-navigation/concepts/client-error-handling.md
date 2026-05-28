<!-- Context: frame-navigation/concepts/client-error-handling | Priority: high | Version: 1.0 | Updated: 2026-03-23 -->

# Client-Side Error Handling

Frame-based navigation with client-side error rendering.

## ErrorCard Pattern

HTML error responses for frame requests:

```typescript
// In entry.tsx resolveFrameResponse
if (res.status === 401) {
  window.location.assign(routes.auth.login.index.href())
  return new Promise(() => {})
}

if (res.status === 403) {
  return (
    <ErrorCard
      eyebrow="Access Denied"
      title="Admin access required"
      message="You don't have permission to view this page."
      action={<a rmx-document href={routes.main.index.href()}>Go to Dashboard</a>}
    />
  )
}
```

## ErrorCard Component

```typescript
type ErrorCardProps = {
  eyebrow: string
  title: string
  message: string
  action?: RemixNode
  animated?: boolean
}

function ErrorCard() {
  return ({ eyebrow, title, message, action, animated }: ErrorCardProps) => (
    <div class={animated ? 'error-card animate-gently-in' : 'error-card'}>
      <p class="error-eyebrow">{eyebrow}</p>
      <h1 class="error-title">{title}</h1>
      <p class="error-message">{message}</p>
      {action}
    </div>
  )
}
```

## Frame Request Detection

Server checks header:

```typescript
let isFrameRequest = ctx.request.headers.get('x-remix-frame') === 'true'
if (isFrameRequest) {
  return new Response('<div>...</div>', { status: 403 })
}
```

Client sets header:

```typescript
headers.set('x-remix-frame', 'true')
```

## Status Code Handling

| Status  | Client Behavior              |
| ------- | ---------------------------- |
| 401     | Redirect to login            |
| 403     | Render ErrorCard             |
| 4xx/5xx | Render ErrorCard with reload |

## CSS Classes

- `.error-card` - Container
- `.error-eyebrow` - Label above title
- `.error-title` - Main heading
- `.error-message` - Description
- `.error-link` - Action links
- `.error-button` - Action buttons

## Reference

- `demos/frame-navigation/app/assets/entry.tsx`
