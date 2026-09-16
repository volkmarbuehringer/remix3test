---
name: remix-file-uploads
description: Use when building upload endpoints or bulk downloads in Remix 3 — multipart parsing, fs/S3/bytea storage, the bytea upload-handler delta, and ZIP archives via node:zlib.
---

# Remix File Uploads — PostgreSQL bytea Backend

For the streaming multipart parser, size limits, and the pluggable storage backends (`remix/file-storage/fs`, `s3`, `memory`), see the vendor READMEs: `node_modules/remix/src/multipart-parser/README.md`, `node_modules/remix/src/form-data-parser/README.md`, `node_modules/remix/src/file-storage/README.md`, and `node_modules/remix/src/form-data-middleware/README.md`.

This skill only documents the hard-won delta: storing files directly in a PostgreSQL `bytea` column, the middleware-ordering gotcha it exposes, and the streaming-parser error-handling pattern (reject-without-throwing + wrapping `formData()` for never-suppressed limit errors).

## Working implementations in this repo

- `app/middleware/uploads.ts` — the `uploadFormData()` wrapper (limit-error PRG), the `fileUploadErrorMessage()` validator, and the `uploadHandler` streaming parser writing to `bytea`.
- `app/middleware/upload-claim.ts` — the `AsyncLocalStorage` scope (`uploadClaimScope` / `addUploadedId` / `takeUploadedIds` / `setUploadError`) that carries server-generated upload ids through the request.
- `app/data/uploads.ts` — `uploads` schema, `insertUpload`, quota queries.
- `app/utils/zip.ts` (+ `app/utils/zip.test.ts`) — the `buildZipArchive` implementation (see §6).
- `app/actions/admin/uploads/controller.tsx` — uploads controller (upload + bulk download routes).
- `app/middleware/root.ts` — middleware ordering (`uploadClaimScope()` before `formData()` before `session()`/`loadAuth()`).

## The deltas

### 1. Middleware ordering is load-bearing

`formData()` runs **before** auth — so `uploadHandler` inserts with `uploaded_by = null` and the controller updates the row after auth. The `AsyncLocalStorage` scope must be installed **before** `formData()` (the handler runs during body parsing, so the scope must already exist):

```
uploadClaimScope(),
formData({ uploadHandler, maxFileSize: 50 * 1024 * 1024 }),
session(cookie, storage),
loadAuth(),  // auth runs AFTER formData
```

### 2. Auth fixup — server-side request scope, NOT the form field

⚠️ **The `file` form value is attacker-controlled.** Claiming `uploaded_by` from `context.formData.get('file')` — even with a scoped `(uploaded_by IS NULL OR uploaded_by = $1)` guard — lets any authenticated user steal any unclaimed upload by POSTing a plain text field `file=<victimId>` (no file part, so `uploadHandler` never runs). See `idor-scope-write-bypass`.

Claim ownership only from the server-scoped id: the handler calls `addUploadedId(id)` per accepted file, and the controller drains the whole batch with `takeUploadedIds()` in one quota check. See `app/middleware/upload-claim.ts`.

### 3. Reject a file without throwing — return `void` + record the reason

Never throw inside `uploadHandler` for an expected rejection (unsupported type, invalid name, too large) — a throw escapes the global `formData()` middleware into an uncaught 500 (see §4). Return `void` and record a reason in the upload-claim scope instead (the repo's `fileUploadErrorMessage()` in `app/middleware/uploads.ts`).

Detection is by request shape, never `instanceof File` (which is always `false` for a file part): `takeUploadedIds().length === 0` **and** `Content-Type` starts with `multipart/` → the upload was rejected. Claim a whole multi-file batch in one quota check, so a near-quota user can't slip files through by claiming last.

### 4. Multipart limit errors are NEVER suppressed — wrap the global `formData()`

`suppressErrors: true` only swallows malformed-body parse errors; multipart **limit** errors (`MaxFileSizeExceededError`, `MaxFilesExceededError`, `MaxPartsExceededError`, `MaxTotalSizeExceededError`) always propagate. And since `runMiddleware` has no catch, a throw inside `formData()` prevents the rest of the chain (auth, db, render, controller) from running, so the controller can't render a friendly page — you get an uncaught 500 + stack trace.

Wrap `formData()` and short-circuit with a `Response` (you cannot "continue" the chain after a downstream middleware throws). For the uploads POST, Post/Redirect/Get to the same path resolved as a GET, carrying an `uploadError` code. See the `uploadFormData()` wrapper in `app/middleware/uploads.ts`.

⚠️ **Keep the `Middleware<{ key: typeof FormData; value: FormData; property: 'formData' }>` context transform on the wrapper.** A bare `Middleware` (default empty transform) drops it and `context.formData` stops existing in the derived `AppContext` — every consumer across the app fails tsc with TS2339 'Property `formData` does not exist'.

Keep `maxFileSize` on `formData()`: it is your per-part **memory bound** (removing it lets the parser buffer an unbounded file → OOM). Enforce the product limit in the handler (return `void`); files over the `maxFileSize` cap surface through the wrapper's redirect.

### 5. Download endpoint

Use a standalone `createAction` route — not nested inside `form()` — returning `new Response(bytea, { headers: Content-Type + Content-Disposition })`. See the uploads controller in `app/actions/admin/uploads/controller.tsx`.

### 6. Bulk ZIP download without a dependency (`node:zlib`)

Zipping usually means adding `archiver`/`jszip`. When you only need a simple archive (a handful of entries, deflate), `node:zlib`'s `deflateRawSync` is exactly what a ZIP entry stores — build the container by hand (three regions: 30-byte local header + filename + deflated data per entry, one 46-byte central-directory header per entry, 22-byte end-of-central-directory record). The working implementation is `app/utils/zip.ts` (with `app/utils/zip.test.ts`); serve it as an attachment via `headers.contentType = 'application/zip'` + `headers.contentDisposition`.

Verify against the real `unzip` tool (not just your own parser) before relying on it:

```sh
unzip -t out.zip   # "No errors detected in compressed data"
```

Gotchas:

- **Duplicate entry names** are legal but confusing — when two files share a name, prefix the later one (e.g. `${id}-${filename}`).
- **Non-ASCII filenames** need the UTF-8 flag (bit 11) set, or extractors mangle them.
- **Sync `deflateRawSync` blocks the event loop** — fine for a handful of entries, but a size guard is prudent for many large files.
- **Empty archive** is valid: just the 22-byte EOCD with `entries.length = 0`.

## References

- `node_modules/remix/src/multipart-parser/README.md` — streaming parser, limits, low-level API
- `node_modules/remix/src/form-data-parser/README.md` — higher-level FormData parsing middleware
- `node_modules/remix/src/file-storage/README.md` — storage interface and built-in backends
- `node_modules/remix/src/file-storage-s3/README.md` — S3 backend
- `node_modules/remix/src/form-data-middleware/README.md` — middleware that exposes `get(FormData)` in request context
- vendor `remix` skill (`.agents/skills/remix/`) — upload examples and middleware patterns
- `remix3-frame-cliententry` (`references/frame-navigation.md`) — serving binary downloads through Frame navigation
- `app/middleware/uploads.ts`, `app/middleware/upload-claim.ts`, `app/data/uploads.ts`, `app/utils/zip.ts`, `app/actions/admin/uploads/controller.tsx` — working implementations in this repo