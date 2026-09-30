/** Server-rendered fallback name for a list with neither title nor description. */
export const UNTITLED_LIST_LABEL = 'Unbenannte Liste'

/**
 * Human label for a sidebar row. Untitled rows carry a `data-list-untitled`
 * marker from the server (kept in sync on the client), so append the list id
 * for those — two untitled lists are otherwise indistinguishable in a picker or
 * a confirm dialog. The marker, not the display text, is the source of truth: a
 * list a user literally names "Unbenannte Liste" stays unmarked.
 */
export function sidebarRowLabel(row: HTMLElement | null | undefined, listId: number): string {
  let raw = row?.querySelector('[data-list-name]')?.textContent?.trim() ?? ''
  if (!raw || row?.hasAttribute('data-list-untitled')) {
    return `${UNTITLED_LIST_LABEL} (#${listId})`
  }
  return raw
}

function sidebarRowFor(listId: number): HTMLElement | null {
  let rows = Array.from(document.querySelectorAll<HTMLElement>(`[data-list-id="${listId}"]`))
  return rows.find((el) => el.querySelector('[data-list-name]')) ?? null
}

export function syncSidebarRow(
  listId: number,
  opts: {
    label: string
    untitled?: boolean | undefined
    count?: number
    doneCount?: number
    updatedAt?: number | undefined
  },
): void {
  let row = sidebarRowFor(listId)
  if (!row) return

  let nameSpan = row.querySelector<HTMLElement>('[data-list-name]')
  if (nameSpan) nameSpan.textContent = opts.label

  let link = row.querySelector<HTMLElement>('a[href]')
  if (link) link.setAttribute('title', opts.label)

  let deleteForm = row.querySelector<HTMLFormElement>('form[data-confirm]')
  if (deleteForm) {
    deleteForm.setAttribute('data-confirm', `"${opts.label}" löschen?`)
    let deleteBtn = deleteForm.querySelector<HTMLElement>('button[aria-label]')
    if (deleteBtn) deleteBtn.setAttribute('aria-label', `Liste "${opts.label}" löschen`)
  }

  if (opts.count !== undefined && opts.doneCount !== undefined) {
    let badge = row.querySelector<HTMLElement>('[data-list-count]')
    if (badge) {
      badge.textContent = `${opts.doneCount}/${opts.count}`
      badge.setAttribute('aria-label', `${opts.doneCount} von ${opts.count} erledigt`)
    }
  }

  if (opts.updatedAt !== undefined) {
    row.setAttribute('data-updated-at', String(opts.updatedAt))
  }

  if (opts.untitled !== undefined) {
    if (opts.untitled) row.setAttribute('data-list-untitled', '')
    else row.removeAttribute('data-list-untitled')
  }
}
