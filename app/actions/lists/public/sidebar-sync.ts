export function sidebarRowFor(listId: number): HTMLElement | null {
  let rows = Array.from(document.querySelectorAll<HTMLElement>(`[data-list-id="${listId}"]`))
  return rows.find((el) => el.querySelector('[data-list-name]')) ?? null
}

export function syncSidebarRow(
  listId: number,
  opts: { label: string; count?: number; doneCount?: number; updatedAt?: number },
): void {
  let row = sidebarRowFor(listId)
  if (!row) return

  let nameSpan = row.querySelector<HTMLElement>('[data-list-name]')
  if (nameSpan) nameSpan.textContent = opts.label

  let link = row.querySelector<HTMLElement>('[data-tooltip]')
  if (link) link.setAttribute('data-tooltip', opts.label)

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
}
