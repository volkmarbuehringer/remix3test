## 1. Author the change

- [x] 1.1 Create the `enable-consistent-return` change
- [x] 1.2 Validate the change

## 2. Enable the rule

- [x] 2.1 Add `typescript/consistent-return` to the shared override
- [x] 2.2 Confirm categories remain `"off"`

## 3. Fix findings

- [x] 3.1 Convert final exhaustive `case` to `default`
- [x] 3.2 Make bare returns explicit
- [x] 3.3 Handle the `process.exit` path
- [x] 3.4 Confirm zero findings

## 4. Verify and commit

- [x] 4.1 `npm run typecheck`
- [x] 4.2 `npm run lint`
- [x] 4.3 `npm test`
- [x] 4.4 Commit with explicit pathspecs and archive
