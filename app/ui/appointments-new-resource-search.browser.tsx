import { clientEntry, type Handle } from 'remix/component'

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('de-DE')
}

function applyFilter(root: HTMLElement, input: HTMLInputElement): void {
  let cards = Array.from(root.querySelectorAll<HTMLElement>('[data-resource-card]'))
  let query = normalize(input.value)
  let visible = 0

  for (let card of cards) {
    let haystack = normalize(card.getAttribute('data-search-text') ?? '')
    let matches = query === '' || haystack.includes(query)
    card.style.display = matches ? '' : 'none'
    if (matches) visible += 1
  }

  let empty = root.querySelector<HTMLElement>('[data-resource-search-empty]')
  if (empty) empty.hidden = visible !== 0

  let count = root.querySelector<HTMLElement>('[data-resource-search-count]')
  if (count) {
    let totalLabel = cards.length === 1 ? 'Ressource' : 'Ressourcen'
    count.textContent =
      query === '' ? `${cards.length} ${totalLabel}` : `${visible} von ${cards.length} Ressourcen`
  }
}

function searchInputFrom(event: Event): HTMLInputElement | null {
  let target = event.target
  if (!(target instanceof HTMLInputElement)) return null
  return target.matches('[data-resource-search]') ? target : null
}

function onSearchInput(event: Event): void {
  let input = searchInputFrom(event)
  if (!input) return
  let root = input.closest<HTMLElement>('[data-resource-search-root]')
  if (root) applyFilter(root, input)
}

function onSearchKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  let input = searchInputFrom(event)
  if (!input || input.value === '') return
  event.preventDefault()
  input.value = ''
  let root = input.closest<HTMLElement>('[data-resource-search-root]')
  if (root) applyFilter(root, input)
}

function applyAllFilters(): void {
  if (typeof document === 'undefined') return
  document.querySelectorAll<HTMLElement>('[data-resource-search-root]').forEach((root) => {
    let input = root.querySelector<HTMLInputElement>('[data-resource-search]')
    if (input) applyFilter(root, input)
  })
}

// Live-filters the resource cards in wizard step 1. The list stays fully
// rendered without JS: filtering only ever hides cards, never reveals hidden
// ones, so the no-script fallback is the unfiltered list.
export const ResourceSearchLive = clientEntry(
  import.meta.url + '#ResourceSearchLive',
  function ResourceSearchLiveEntry(handle: Handle) {
    // Delegated on `document`, because frame navigation replaces the <input>
    // node. Schedule the browser-only setup after the client commit and bind it
    // to `handle.signal`, so a frame swap removes the old entry's listeners
    // before the replacement entry installs its own (guide 05 §"DOM references,
    // global events, and cleanup").
    handle.queueTask(() => {
      if (typeof document === 'undefined') return
      document.addEventListener('input', onSearchInput, { signal: handle.signal })
      document.addEventListener('keydown', onSearchKeydown, { signal: handle.signal })
    })

    return () => {
      // The card DOM can be replaced without remounting the entry; re-apply the
      // field's current query to the freshly rendered cards.
      handle.queueTask(applyAllFilters)
      return null
    }
  },
)
