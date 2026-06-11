## 1. Update `app/ui/chat-page.tsx`

- [x] 1.1 In the message meta section (after the role label), add a timestamp display:
  ```tsx
  {msg.timestamp && <span> · {new Date(msg.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>}
  ```
- [x] 1.2 The added span should use the existing `messageLabelStyle` for consistent styling

## 2. Update `app/ui/agent-page.tsx`

- [x] 2.1 In the message meta section (after the role label), add the same timestamp display:
  ```tsx
  {msg.timestamp && <span> · {new Date(msg.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>}
  ```
- [x] 2.2 The added span should use the existing `messageLabelStyle` for consistent styling

## 3. Verify

- [x] 3.1 Run `npm run typecheck` to confirm no type errors
- [x] 3.2 Run `npm test` to confirm existing tests still pass
