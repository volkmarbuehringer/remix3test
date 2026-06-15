## ADDED Requirements

### Requirement: Admin action buttons SHALL be server-rendered submit buttons

Each per-row AdminActionButton SHALL be a `<button type="submit" data-confirm="...">` inside the existing `<form method="POST">`. The form SHALL include `rmx-target={frames.adminContent}` for Frame-aware navigation. Hidden inputs SHALL carry any offset/sort state needed.

### Requirement: Destroy actions SHALL redirect to admin index fragment

After delete, the admin controller actions SHALL redirect to the admin index route (e.g., `/admin/lists`, `/admin/messages`, `/admin/chatlog`) with preserved grid state, so the Frame navigates to the fragment URL.

### Requirement: Admin pages SHALL include ConfirmDelete

Each admin page using the delete form SHALL render `<ConfirmDelete />` once in its component tree to enable `data-confirm` confirmation dialogs.
