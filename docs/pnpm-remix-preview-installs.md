# Remix Preview Installs (Retained Tarballs)

**Extracted:** 2026-10-23
**Updated:** 2026-11-03 (retained-tarball install format; the pre-2026-11-03
`github:…&path:` recipes are in
[`history/pnpm-git-hosted-installs.md`](history/pnpm-git-hosted-installs.md))
**Context:** the app pins `remix` and `@remix-run/ui` to retained
`preview/main` tarballs at `t/<source-sha>/<pkg>.tgz`. Upstream #12126 replaced
the committed `packages/*` preview trees with those tarballs plus a
`t/preview.json` manifest, so the lock is content-addressed and cannot mix
builds the way the old `path:` specs could.

**Automation:** `npm run update:remix` (`scripts/update-remix.ts`) resolves
`preview/main`, reads `t/preview.json` from that build commit, rewrites the two
tarball specs, runs `pnpm install`, verifies the lock has one `t/<sha>` build,
runs a frozen-install check, repoints the vendor skill links, then
typecheck/lint/format/tests. Use `--dry-run`, `--no-tests`, or `--allow-dirty`.
It still migrates old `github:` specs on the first run.

## Current tarball flow (2026-11-03+)

The manifest lists each package's tarball URL and the source SHA; tarball
dependencies inside the manifest are rewritten to the same build's URLs. The
update script:

1. `git ls-remote` the `preview/main` build commit.
2. Fetch `https://raw.githubusercontent.com/remix-run/remix/<build>/t/preview.json`
   (the commit URL avoids the branch file's CDN cache; validate `branch`, the
   source SHA, and that both tarball URLs use the same `t/<8-hex>/` prefix).
3. Rewrite the `remix` and `@remix-run/ui` dependency specs to the manifest URLs.
4. Run `pnpm install --no-frozen-lockfile`; there is no git-hosted prepare, so
   the nested `pnpm install` / `ERR_PNPM_PREPARE_PACKAGE` failure mode is gone.
5. Verify every preview ref in the lock is `t/<same-prefix>/` and no
   `codeload.github.com` refs remain.
6. Run the frozen-install check, repoint `.agents/skills/remix` and
   `.opencode/skills/remix`, then typecheck/lint/format/tests.

**Retention matters.** `preview/main` removes builds older than about seven days
(and keeps the latest), so a lockfile that points at an old `t/<sha>` URL can
404 after retention. Refresh the pin before the tarball disappears; an expired
build needs a newer URL and lock update.

Run `npm run remix:pin:check` to verify the pin: it checks that every
`@remix-run/*` ref in `pnpm-lock.yaml` uses the same `t/<sha>` prefix as
`package.json` (mixed prefixes and leftover codeload refs fail), then HEADs both
tarball URLs and reads `t/preview.json` to warn when the build is older than
five days. The check is dependency-free and treats network failures as warnings,
so it is safe offline; add `-- --strict` to make the refresh warning a failure.

## Keep the lock; old build dirs are not pruned

A normal `pnpm install` leaves the previous build's `node_modules/.pnpm/*`
entries in place (the 2026-11-03 migration left 50 codeload dirs). They are
unreferenced but still occupy disk; a clean
`rm -rf node_modules && pnpm install --frozen-lockfile` relinks only the lock's
packages (verified: 50 tarball dirs, 0 codeload dirs). `pnpm store prune` then
reclaims unreferenced store content.

Keep `pnpm-lock.yaml`: a frozen install relinks from the store, while deleting
the lock re-resolves all 270 refs (and, on an old pin, re-prepared the monorepo
per `path:` entry). Inspect `git diff package.json` after any update:
`pnpm update <pkg>` can float an unrelated direct dependency without completing
the lock importer.

## Sandbox store notes (still apply)

### `ERR_PNPM_EROFS` writing the global store

Writes outside the workspace are denied. Install into a workspace store:

```sh
pnpm install --store-dir "$PWD/.pnpm-store"
```

Add `.pnpm-store/` to `.git/info/exclude` (local) or `.gitignore`, and keep it
alongside `node_modules`. The lockfile's tarball refs/integrity are unaffected.
The current tarball flow does not spawn a nested pnpm install, but
`scripts/update-remix.ts` still exports `npm_config_store_dir` /
`npm_config_cache_dir` so pnpm and any child process agree on the store.

### `ERR_PNPM_UNEXPECTED_STORE` after switching `--store-dir`

`node_modules` was linked from the old store. Plain `pnpm install` does **not**
relink while `node_modules/.pnpm/lock.yaml` matches the root lockfile — it
prints "Already up to date" even after removing `node_modules/.modules.yaml`.
Remove `node_modules` and run a frozen install, or use a lockfile-changing
command, to force a full re-link into the new store.

## When to Use

- You need to bump the preview pin or the current tarball-manifest update flow.
- `npm run remix:pin:check` reports a mixed prefix, a leftover codeload ref, or
  a build older than the refresh window.
- `pnpm install` fails with `EROFS` or `UNEXPECTED_STORE`.
- `pnpm install` says "Already up to date" but `node_modules` still points at
  the old store/build.
- You are debugging an old pin that still uses `github:…#path:` specs.
