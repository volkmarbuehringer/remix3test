// Preview release tags are not chronological, and their shape changed twice.
// #12174 introduced `v0.<UTC date>.<counter>-main-<sha8>`; #12311 pinned main
// builds to counter `0`; #12319 made the date the patch and the build revision
// `0`, giving `v0.0.<UTC date>-main-<sha8>`. Both main formats stay valid while
// older pins are installable, so the matchers accept either one. PR previews
// use `v0.0.<date>-pr-<number>` tags and are not `main` builds, so they stay
// out of these patterns.
const MAIN_TAG_SOURCE = String.raw`v0\.(?:[1-9]\d{7}\.(?:0|[1-9]\d{0,5})|0\.[1-9]\d{7})-main-([0-9a-f]{8})`

/** Matches a `main` preview release tag and captures the 8-hex source SHA. */
export const MAIN_RELEASE_TAG_RE = new RegExp(`^${MAIN_TAG_SOURCE}$`)

/**
 * Matches a release asset URL for a `main` preview build and captures the tag,
 * the source SHA, and the tarball name. `filePattern` is a regex fragment, e.g.
 * `'(?:remix|ui)'` or `'[^/]+'`.
 */
export function releaseAssetUrlRe(filePattern: string): RegExp {
  return new RegExp(
    `^https://github\\.com/remix-run/previews/releases/download/(${MAIN_TAG_SOURCE})/(${filePattern})\\.tgz$`,
  )
}
