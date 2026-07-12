## 1. Shared Error Module

- [x] 1.1 Create `app/actions/mastra/tools/errors.ts` with `ErrorCode` enum, `errorEnvelope` schema, and `successData<T>` helper type
- [x] 1.2 Add `describe()` calls to each field in the error envelope (`code`, `message`)

## 2. `listTestFiles` Output Schema

- [x] 2.1 Define `fileEntrySchema` Zod object with `describe()` on all fields (`name`, `isDirectory`, `size`, `mtime`, `display.*`)
- [x] 2.2 Define `listTestFilesOutput` as `z.discriminatedUnion('success', [...])` with success and error branches
- [x] 2.3 Wire `outputSchema` into `createTool` call

## 3. Execute Function Refactor

- [x] 3.1 Add `as const` annotations to all error returns in `execute`
- [x] 3.2 Wrap success return in `{ success: true, data: { ... } }` envelope
- [x] 3.3 Verify TypeScript narrowing works (no `as any` needed for envelope access)

## 4. Test Updates

- [x] 4.1 Update all assertions to access `result.data.files` instead of `result.files`
- [x] 4.2 Update error tests to check `result.success === false` and `result.error.code`
- [x] 4.3 Remove `as` casts that are now typed from the schema
- [x] 4.4 Run `npm test` and confirm all tests pass
