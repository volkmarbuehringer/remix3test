// Preview release tags are not chronological. Upstream #12311 changed main
// tags from `v0.<date>.<time>-…` to `v0.<date>.0-main-<sha>`, and #12319 moved
// the date to the patch (`v0.0.<date>-main-<sha>`), so a same-day time-of-day
// tag (for example `v0.20261117.163354-…`) sorts above a newer `.0` tag even
// though its release published later, and the new shape sorts below both.
// Order releases by their publish timestamp instead; the tag counter is not a
// clock.

export type PreviewReleaseTimestamps = {
  published_at?: string | null
  created_at?: string
}

export function releasePublishedAt(release: PreviewReleaseTimestamps): number {
  for (let value of [release.published_at, release.created_at]) {
    if (!value) continue
    let parsed = Date.parse(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

export function sortReleasesByPublishedAt<T extends PreviewReleaseTimestamps>(
  releases: readonly T[],
): T[] {
  return releases.toSorted((a, b) => releasePublishedAt(b) - releasePublishedAt(a))
}
