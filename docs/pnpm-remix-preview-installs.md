# Remix Preview Installs (Preview Releases)

**Extracted:** 2026-10-23
**Updated:** 2026-11-04 (preview-release assets; the pre-2026-11-04
retained-tarball and pre-2026-11-03 `github:…&path:` recipes are in
[`history/pnpm-git-hosted-installs.md`](history/pnpm-git-hosted-installs.md) and
`docs/remix-pin-history.md`)
**Context:** the app pins `remix` and `@remix-run/ui` to tarball assets on a
`remix-run/previews` GitHub release at
`https://github.com/remix-run/previews/releases/download/<tag>/<pkg>.tgz`.
Upstream #12174 replaced the `preview/main` retained-tarball branch with one
release per `main` commit, so the lock is still content-addressed and cannot mix
builds, but the URL host and retention mechanism changed.

**Automation:** `npm run update:remix` (`scripts/update-remix.ts`) resolves the
latest main preview release, rewrites the two tarball specs, runs `pnpm install`,
verifies the lock has one release tag, runs a frozen-install check, repoints the
vendor skill links, then typecheck/lint/format/tests. Use `--dry-run`,
`--no-tests`, or `--allow-dirty`. It still migrates the old `github:` and
`t/<sha>/` specs on the first run.

## Current release-asset flow (2026-11-04+)

Every push to `remix` `main` publishes a release in `remix-run/previews`,
tagged `v0.<date>.<time>-main-<source-sha-8>`. The assets are one tarball per
package (`remix.tgz`, `ui.tgz`, `component.tgz`, …) plus `remix.url`; each
tarball rewrites its `@remix-run/*` dependencies to the same release's asset
URLs. The update script:

1. `git ls-remote` the `remix` `main` tip for reporting.
2. Read `https://api.github.com/repos/remix-run/previews/releases/latest`; PR
   previews are prereleases and are not selected. Validate the tag, the source
   SHA suffix, and that both pinned assets have the expected names and URLs.
   If `main` has advanced past the latest published build, the script says so
   and pins the latest available release.
3. Rewrite the `remix` and `@remix-run/ui` dependency specs to the release asset
   URLs.
4. Run `pnpm install --no-frozen-lockfile`; there is no git-hosted prepare, so
   the nested `pnpm install` / `ERR_PNPM_PREPARE_PACKAGE` failure mode is gone.
5. Verify every preview ref in the lock is the same release tag and no
   `codeload.github.com` or `raw.githubusercontent.com/…/t/` refs remain.
6. Run the frozen-install check, repoint `.agents/skills/remix` and
   `.opencode/skills/remix`, then typecheck/lint/format/tests.

**Retention matters.** Main preview releases are pruned after about seven days
(the newest is kept), so a lockfile that points at an old release tag can 404
after retention. Refresh the pin before the assets disappear; an expired
release needs a newer tag and lock update.

Run `npm run remix:pin:check` to verify the pin: it checks that every
`@remix-run/*` ref in `pnpm-lock.yaml` uses the same release tag as
`package.json` (mixed tags, retained-tarball refs, and leftover codeload refs
fail), then HEADs both tarball URLs and reads the latest main preview release to
warn when the pin is not the newest or is older than five days. The check is
dependency-free and treats network failures as warnings, so it is safe offline;
add `-- --strict` to make the refresh warning a failure.

## Keep the lock; old build dirs are not pruned

A normal `pnpm install` leaves the previous build's `node_modules/.pnpm/*`
entries in place. They are unreferenced but still occupy disk; a clean
`rm -rf node_modules && pnpm install --frozen-lockfile` relinks only the lock's
packages. `pnpm store prune` then reclaims unreferenced store content.

Keep `pnpm-lock.yaml`: a frozen install relinks from the store, while deleting
the lock re-resolves every ref. Inspect `git diff package.json` after any
update: `pnpm update <pkg>` can float an unrelated direct dependency without
completing the lock importer.

## Sandbox store notes (still apply)

### `ERR_PNPM_EROFS` writing the global store

Writes outside the workspace may be denied. Install into a workspace store:

```sh
pnpm install --store-dir "$PWD/.pnpm-store"
```

Add `.pnpm-store/` to `.git/info/exclude` (local) or `.gitignore`, and keep it
alongside `node_modules`. The lockfile's tarball refs/integrity are unaffected.
`scripts/update-remix.ts` exports both `pnpm_config_store_dir` /
`pnpm_config_cache_dir` (pnpm 12) and `npm_config_store_dir` /
`npm_config_cache_dir` (older pnpm / nested installs) so pnpm and any child
process agree on the store; pass `--store-dir <path>` to use a different one
(for example the currently linked global store).

### Plain `pnpm update` picks the global store

Once `node_modules` is linked from `.pnpm-store`, every pnpm command must keep
passing that store. `pnpm update` does not remember it from
`node_modules/.modules.yaml`; without the flag it falls back to
`~/.local/share/pnpm/store/v11` and exits with `ERR_PNPM_UNEXPECTED_STORE`
("currently linked from …/.pnpm-store/v11"). Rerun the same command with the
store:

```sh
pnpm update --store-dir "$PWD/.pnpm-store"
```

The same applies to `pnpm add`, `pnpm remove`, and any other lockfile-changing
command in this workspace.

### `ERR_PNPM_UNEXPECTED_STORE` after switching `--store-dir`

`node_modules` was linked from the old store. Plain `pnpm install` does **not**
relink while `node_modules/.pnpm/lock.yaml` matches the root lockfile — it
prints "Already up to date" even after removing `node_modules/.modules.yaml`.
Remove `node_modules` and run a frozen install, or use a lockfile-changing
command, to force a full re-link into the new store.

## When to Use

- You need to bump the preview pin or debug the release-asset update flow.
- `npm run remix:pin:check` reports a mixed tag, a legacy tarball/codeload ref,
  or a release older than the refresh window.
- `pnpm install` or `pnpm update` fails with `EROFS` or `UNEXPECTED_STORE`.
- `pnpm install` says "Already up to date" but `node_modules` still points at
  the old store/build.
- You are debugging an old pin that still uses `github:…#path:` or
  `t/<sha>/` specs.
