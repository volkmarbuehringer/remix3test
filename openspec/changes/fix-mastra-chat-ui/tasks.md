## 1. Auto-scroll

- [ ] 1.1 Add `id="chat-end"` anchor after the message list in `admin-mastra-chat-page.tsx`
- [ ] 1.2 Append `#chat-end` to the redirect URL in `mastra/controller.tsx` after successful POST

## 2. Compact layout

- [ ] 2.1 Reduce form `padding` from `xl` to `md`, remove `border` and `boxShadow` from `formStyle`
- [ ] 2.2 Reduce `textarea` `minHeight` from `100px` to `60px`

## 3. Verify

- [ ] 3.1 Run `npm run typecheck` — no errors
- [ ] 3.2 Run `npm run lint` — no errors
