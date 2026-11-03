# pnpm Installs With `github:…#branch&path:` Dependencies

> **2026-11-03: historical for the current pin.** Upstream #12126 replaced the
> branch/path preview layout with retained tarballs plus `t/preview.json`. The app
> now pins
> `https://raw.githubusercontent.com/remix-run/remix/preview/main/t/<sha>/{remix,ui}.tgz`,
> and `npm run update:remix` rewrites those specs. See [Current tarball
> flow](#current-tarball-flow-2026-11-03) below; the `github:` recipes are kept
> for old pins and archaeology.

**Extracted:** 2026-10-23
**Updated:** 2026-11-03 (tarball install format; the `github:` sections below are historical)
**Context:** the app used to pin `remix` and `@remix-run/ui` to
`github:remix-run/remix#preview/main&path:packages/…`. Every `pnpm update`/`add`
could re-resolve and re-prepare the whole monorepo tarball; in the DSH sandbox the
global store is also read-only. Both make the obvious command fail in
non-obvious ways. Observed on the `db58e1d9 → 1e03013e1` bump.

**Automation:** `npm run update:remix` (`scripts/update-remix.ts`) now resolves
`preview/main`, reads `t/preview.json` from that build commit, rewrites the two
tarball specs, runs `pnpm install`, verifies the lock has one `t/<sha>` build,
runs a frozen-install check, repoints the vendor skill links, then
typecheck/lint/format/tests. It still migrates old `github:` specs on the first
run. Use `--dry-run`, `--no-tests`, or `--allow-dirty`.

## Current tarball flow (2026-11-03+)

`preview/main` build commits carry retained tarballs under `t/<source-sha>/` and
a manifest at `t/preview.json`; the manifest lists each package's tarball URL
and the source SHA. Tarball dependencies inside the manifest are rewritten to
the same build's tarball URLs, so the lock is content-addressed and cannot mix
builds the way the old `path:` specs could.

The update script:

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

**Stale virtual-store dirs.** A normal `pnpm install` leaves the previous
build's `node_modules/.pnpm/*` entries in place (the 2026-11-03 migration left
50 codeload dirs). They are unreferenced but still occupy disk; a clean
`rm -rf node_modules && pnpm install --frozen-lockfile` relinks only the lock's
packages (verified: 50 tarball dirs, 0 codeload dirs).

The store notes below still apply (`--store-dir`, the `npm_config_*` environment
for any nested pnpm invocation, `ERR_PNPM_UNEXPECTED_STORE`). The
git-hosted/codeload symptoms are old-layout only.

## `install` has no cache-bypass flag

| flag                             | actual effect                                                                                                                 |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `--force`                        | refetches store-modified packages and can recreate the lockfile, but still prepares the git-hosted monorepo per `path:` entry |
| `--store-dir <empty>`            | true cold cache (re-downloads everything); deleting `.pnpm-store/` is equivalent                                              |
| `--prefer-offline` / `--offline` | the opposite: prefer / require the cache                                                                                      |
| `--ignore-scripts`               | skips lifecycle scripts, **not** the git prepare/extract                                                                      |

`--frozen-store` is for a read-only store and is incompatible with `--force`.

## Deleting `pnpm-lock.yaml` is the expensive trigger

`rm -rf node_modules` alone is cheap: a frozen install re-links from the store.
Deleting the lock makes pnpm re-resolve the floating `#preview/main` tips for
the two top-level specs **and** every transitive `@remix-run/*` path, then
download/prepare the monorepo tarball again (268 path prepares). Keep the lock:

```sh
rm -rf node_modules
pnpm install --frozen-lockfile --store-dir "$PWD/.pnpm-store" \
  --prefer-offline --network-concurrency=1 --fetch-retries=10 \
  --fetch-retry-mintimeout=2000 --fetch-retry-maxtimeout=60000
```

## `ERR_PNPM_EROFS` writing `~/.local/share/pnpm/store/v11/files/…`

Writes outside the workspace are denied. Install into a workspace store:

```sh
pnpm update remix @remix-run/ui --store-dir "$PWD/.pnpm-store"
```

The flag alone does not cover the git-hosted prepare: pnpm runs a **nested**
`pnpm install` for the extracted monorepo, and that child inherits only the
environment, not the CLI flags. Give it the store and cache as npm config:

```sh
npm_config_store_dir="$PWD/.pnpm-store" \
npm_config_cache_dir="$PWD/.pnpm-store/cache" \
  pnpm update remix @remix-run/ui --store-dir "$PWD/.pnpm-store"
```

Without them the nested install falls back to the default store and, when
`~/.local/share/pnpm/store` or `~/.cache/pnpm` is read-only, the update dies
with `ERR_PNPM_PREPARE_PACKAGE` (nested `pnpm install`, exit 226).
`npm run update:remix` exports both and relinks `node_modules` when its
`.modules.yaml` names a different store.

Add `.pnpm-store/` to `.git/info/exclude` (local) or `.gitignore`, and keep it
alongside `node_modules`. The lockfile's tarball refs/integrity are unaffected.

## `ERR_PNPM_UNEXPECTED_STORE` after switching `--store-dir`

`node_modules` was linked from the old store. Plain `pnpm install` does **not**
relink while `node_modules/.pnpm/lock.yaml` matches the root lockfile — it
prints "Already up to date" even after removing `node_modules/.modules.yaml`.
The lockfile-changing command (the `pnpm update` you intended) is what makes
pnpm relink; expect a full re-link into the new store.

## SHA-pinning the top-level specs is not a full pin

Writing `github:remix-run/remix#<sha>&path:packages/remix` (and `…/ui`) leaves
the generated tarball's own dependencies on the branch: they are still
`remix-run/remix#preview/main&path:packages/…`. A lockless install can therefore
resolve the top-level SHA you wrote while pulling a newer tip for the transitive
`@remix-run/*` set — the "Branch-pin transitive race" note in
`../.opencode/skills/learned/remix3-tooling/references/remix3-build-and-tooling/upstream-dependency-analysis.md`. The unified
lockfile is the only artifact that pins all 268 refs together; do not delete it.

## A frozen install does not prune old build dirs

After a bump, `node_modules/.pnpm/@remix-run+*@…<old-sha>…` dirs remain (29 in
this app); `pnpm install --frozen-lockfile` prints "Already up to date" and
leaves them. Only `rm -rf node_modules && pnpm install --frozen-lockfile`
rebuilds the tree; `pnpm store prune` then reclaims unreferenced store content.

## Git-hosted work repeats per `path:` entry

`pnpm update remix @remix-run/ui` fetched the ~20 MB codeload tarball and
unpacked/prepared it once per `@remix-run/*` path — 268 lock refs, ~7 min,
~3 GB store. Default concurrency plus slow codeload produced repeated
`ERR_PNPM_FETCH_429`; this completed:

```sh
pnpm update remix @remix-run/ui --store-dir "$PWD/.pnpm-store" \
  --prefer-offline --network-concurrency=1 --fetch-retries=10 \
  --fetch-retry-mintimeout=2000 --fetch-retry-maxtimeout=60000
```

The first successful fetch indexes the tarball; later paths reuse it locally,
so the run stays slow but network-light. `--ignore-scripts` skips lifecycle
scripts but **not** the git-hosted prepare/extract step.
With a warm content-addressable store the 2026-10-31 bump downloaded only 50
packages and took ~4m45s; the prepare-per-path cost remains.

## `ERR_PNPM_PREPARE_PACKAGE` when updating an unrelated package

(For the remix pin itself, check the EROFS section first: the nested prepare
install usually just needs `npm_config_store_dir`/`npm_config_cache_dir`.)

`pnpm update nodemailer` still re-resolved/re-prepared the git-hosted remix
package and failed in its nested `pnpm install` (exit 226). Patch the lock and
use a frozen install instead:

1. `curl -s https://registry.npmjs.org/<pkg>/<version>` → `dist.integrity`
   (and `engines`). `npm view` writes to `~/.npm`, which is also EROFS.
2. Edit `package.json` plus `pnpm-lock.yaml`: importer `specifier`/`version`,
   the `packages:` block (`resolution: {integrity: …}`, `engines`), and the
   `snapshots:` key.
3. `pnpm install --frozen-lockfile --store-dir "$PWD/.pnpm-store" \
   --prefer-offline --network-concurrency=1`

Frozen mode skips resolution, fetches only the changed package, and still runs
the frozen/supply-chain checks.

## `pnpm update <pkg>` can bump an unrelated direct dep

`pnpm update remix @remix-run/ui` changed `nodemailer` to `^10.2.1` in
`package.json` without updating the lock importer. Always inspect
`git diff package.json` after an update and either complete the bump in the
lock or revert it.

## When to Use

- `pnpm update`/`install` fails with `EROFS`, `UNEXPECTED_STORE`,
  `PREPARE_PACKAGE`, or repeated `FETCH_429` on the remix tarball.
- You need to bump a non-remix package without re-preparing the monorepo.
- `pnpm install` says "Already up to date" but `node_modules` still points at
  the old store/build.
- You are about to delete `pnpm-lock.yaml` or look for a `--no-cache` flag.
