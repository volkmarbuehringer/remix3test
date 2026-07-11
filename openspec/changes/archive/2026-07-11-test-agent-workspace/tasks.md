## 1. Agent Configuration

- [x] 1.1 Add workspace + LocalFilesystem (basePath: PROJECT_ROOT) to test-agent.ts with read_file (approval) enabled, all other workspace tools disabled
- [x] 1.2 Import listTestFiles (not testTools) from test-tools.ts; remove readTestFile dependency
- [x] 1.3 Update agent instructions: reference mastra_workspace_read_file for reading, listTestFiles for listing

## 2. Controller Update

- [x] 2.1 Change requireToolApproval callback to check `mastra_workspace_read_file` instead of `readTestFile`

## 3. Tool Cleanup

- [x] 3.1 Remove readTestFile from test-tools.ts; export listTestFiles directly
- [x] 3.2 Remove read_test_file tests from test-tools.test.ts
- [x] 3.3 Share PROJECT_ROOT between test-tools.ts and test-agent.ts to eliminate basePath drift

## 4. Verify

- [x] 4.1 Run typecheck (`npm run typecheck`)
- [x] 4.2 Run tests (`npm test`)
- [ ] 4.3 Manual smoke test: open /testagent, send a message, verify read approval flow and directory listing
