## 1. Uploads Controller — ClientEntry

- [x] 1.1 Add `clientEntry`, `ref`, and `Handle` imports from `remix/ui` in `app/actions/uploads/controller.tsx`
- [x] 1.2 Define `UploadFormHandler` clientEntry that finds the form by id, intercepts submit, sends via `fetch`, and calls `handle.frame.replace()` with the response HTML
- [x] 1.3 Add `id="upload-form"` to the `<form>` element in `UploadsContent`
- [x] 1.4 Render `<UploadFormHandler />` inside the `UploadsContent` return JSX

## 2. Verify

- [x] 2.1 Run `npm run typecheck` — no type errors
- [x] 2.2 Run `npm test` — 973/973 tests pass, 0 failures
- [x] 2.3 Manual test: navigate route-agent to uploads, upload a file — agent stays intact, upload works, frame refreshes with updated list
