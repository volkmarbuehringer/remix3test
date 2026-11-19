/**
 * Parsing for the changesets-generated `packages/<name>/CHANGELOG.md` files.
 *
 * `scripts/update-remix.ts` fetches these from the target source commit before
 * installing. A version bump alone is not enough of a warning: upstream has
 * shipped consumer-breaking behavior as a minor (data-table 1.1.0 expanded
 * `sql` arrays and started `JSON.stringify`-ing `column.json()` values), so the
 * installer prints every `Major`/`Minor`/`Patch` entry above the installed
 * version. Kept separate from the CLI so the parser can be tested directly.
 */

export type ChangelogSection = { version: string; body: string }

/** Newest-first `## vX.Y.Z` sections; pre-heading prose is ignored. */
export function parseChangelogSections(text: string): ChangelogSection[] {
  let sections: ChangelogSection[] = []
  let current: ChangelogSection | undefined
  for (let line of text.split(/\r?\n/)) {
    let heading = /^##\s+v?(\S+)\s*$/.exec(line)
    if (heading) {
      current = { version: heading[1] ?? '', body: '' }
      sections.push(current)
      continue
    }
    if (current) current.body += line + '\n'
  }
  return sections
}

/**
 * Sections newer than the installed version. The changelog is newest-first, so
 * everything above the installed heading is new; an unknown installed version
 * falls back to the newest section, which is the relevant one either way.
 */
export function newChangelogSections(
  text: string,
  installed: string | undefined,
): ChangelogSection[] {
  let sections = parseChangelogSections(text)
  if (!installed) return sections.slice(0, 1)
  let at = sections.findIndex((section) => section.version === installed.replace(/^v/, ''))
  return at === -1 ? sections.slice(0, 1) : sections.slice(0, at)
}

/**
 * Keep every `### … Changes` block (Major included) with its prose, and drop
 * anything else in the section (changeset boilerplate, docs notes). Major
 * entries must not be filtered out: a major is the one case where silence would
 * be actively misleading.
 */
export function changelogHighlights(body: string): string {
  let lines: string[] = []
  let keep = false
  for (let line of body.split(/\r?\n/)) {
    let heading = /^###\s+(.+?)\s*$/.exec(line)
    if (heading) {
      let title = heading[1] ?? ''
      keep = /changes?$/i.test(title)
      if (keep) lines.push('### ' + title)
      continue
    }
    if (keep) lines.push(line)
  }
  return lines.join('\n').trim()
}
