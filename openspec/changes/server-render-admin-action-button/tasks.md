## 1. Remove admin-action-button.tsx

- [x] 1.1 Delete `app/assets/admin-action-button.tsx`

## 2. Admin lists page: replace clientEntry with submit button

- [x] 2.1 In `app/ui/admin-lists-page.tsx`, replace `<AdminActionButton>` with `<button type="submit" data-confirm="...">`
- [x] 2.2 Add `rmx-target={frames.adminContent}` to the delete form

## 3. Admin messages page: replace clientEntry with submit button

- [x] 3.1 In `app/ui/admin-messages-page.tsx`, replace `<AdminActionButton>` with `<button type="submit" data-confirm="...">`
- [x] 3.2 Add `rmx-target={frames.adminContent}` to the delete form

## 4. Admin chatlog page: replace clientEntry with submit button

- [x] 4.1 In `app/ui/admin-chatlog-page.tsx`, replace `<AdminActionButton>` with `<button type="submit" data-confirm="...">`
- [x] 4.2 Add `rmx-target={frames.adminContent}` to the delete form

## 5. Ensure ConfirmDelete is present

- [x] 5.1 Added `<ConfirmDelete />` to admin lists, messages, and chatlog pages
