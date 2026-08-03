## 1. Refactor email HTML builders in locale

- [x] 1.1 Add `import { html } from 'remix/html-template'` to `app/locale/de.ts`
- [x] 1.2 Rewrite `verification.html` to return `String(html\`...\`)` interpolating `name` and `url`
- [x] 1.3 Rewrite `passwordReset.html` to return `String(html\`...\`)` interpolating `name` and `url`
- [x] 1.4 Rewrite `accountDeletion.self.html` to return `String(html\`...\`)` interpolating `name`
- [x] 1.5 Rewrite `accountDeletion.admin.html` to return `String(html\`...\`)` interpolating `name`
- [x] 1.6 Delete the now-unused `esc` helper

## 2. Tests

- [x] 2.1 Extend the "HTML escaping" block in `app/utils/send-email.test.ts` with a single-quote case (e.g. name `O'Brien` → body contains `O&#39;Brien`)
- [x] 2.2 Add an assertion that `email.html` is a plain `string` (not a `SafeHtml` object)
- [x] 2.3 Run `npm test -- app/utils/send-email.test.ts` and confirm existing email tests stay green
- [x] 2.4 Run `npm run typecheck`
