# Button import migration

## Files (29 total)

**Actions:**

- `app/actions/client/create-page.tsx`
- `app/actions/client/edit-page.tsx`
- `app/actions/client/grid-page.tsx`

**Assets:**

- `app/assets/admin-delete-past-button.tsx`
- `app/assets/lists-client.tsx`

**UI pages:**

- `app/ui/admin-appointments-form.tsx`
- `app/ui/admin-appointments-page.tsx`
- `app/ui/admin-chatlog-page.tsx`
- `app/ui/admin-lists-page.tsx`
- `app/ui/admin-messages-page.tsx`
- `app/ui/admin-nutzer-create-page.tsx`
- `app/ui/admin-nutzer-edit-page.tsx`
- `app/ui/admin-nutzer-page.tsx`
- `app/ui/admin-offering-configs-page.tsx`
- `app/ui/admin-offerings-config-page.tsx`
- `app/ui/admin-offerings-create-page.tsx`
- `app/ui/admin-offerings-edit-page.tsx`
- `app/ui/admin-offerings-page.tsx`
- `app/ui/admin-offerings-week-page.tsx`
- `app/ui/admin-resources-page.tsx`
- `app/ui/admin-users-page.tsx`
- `app/ui/agent-page.tsx`
- `app/ui/appointments-new-form.tsx`
- `app/ui/appointments-new-page.tsx`
- `app/ui/appointments-new-step2.tsx`
- `app/ui/auth-card.tsx`
- `app/ui/chat-page.tsx`
- `app/ui/showcase-pages.tsx`
- `app/ui/workflow-page.tsx`

## Change

```diff
- import { Button } from 'remix/ui/button'
+ import { Button } from 'remix/components/button'
```

## Verification

After change, `Button` should be usable identically — same props, same behavior.
