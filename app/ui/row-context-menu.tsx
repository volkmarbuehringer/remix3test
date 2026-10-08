import { css, ref, type Handle, type RemixNode } from 'remix/component'
import * as menu from '@remix-run/ui/menu'
import { onMenuSelect } from '@remix-run/ui/menu'

import { safeNavigate } from '../utils/frame-utils.ts'
import { gridStateToParams, type GridState } from '../utils/grid-state.ts'
import { MenuList } from './theme/menu/index.tsx'

/**
 * The row captured at right-click time. Passed to the menu's item renderer and
 * to its select handler, so a menu can read any per-row `data-*` attribute.
 */
export interface RowMenuTarget {
  /** The row's `data-row-id` (empty string when the attribute has no value). */
  rowId: string
  /** The right-clicked row element. */
  row: HTMLElement
}

export interface RowContextMenuOptions {
  /** Accessible label for `menu.Context`. */
  label: string
  /** Selector for the table whose rows open the menu (event delegation target). */
  tableSelector: string
  /**
   * Re-render after capturing a row. Set this when the *rendered* items depend
   * on per-row attributes (e.g. a row's status); `items` then sees the new
   * target on the next render.
   */
  reactive?: boolean
  /** The menu items. `target` is null until the first row is captured. */
  items: (target: RowMenuTarget | null) => RemixNode
  /** Dispatch a selected item name against the captured row. */
  onSelect: (name: string, target: RowMenuTarget, handle: Handle) => void
}

/*
 * Hidden trigger element, positioned at right-click coordinates. Uses
 * `opacity: 0` (not `display: none`) so the synthetic `contextmenu` event
 * dispatches correctly and `getBoundingClientRect()` works.
 */
const hiddenTrigger = css({
  position: 'fixed',
  width: 0,
  height: 0,
  opacity: 0,
  pointerEvents: 'none',
})

/**
 * Build the shared machinery for a grid row's right-click context menu: a hidden
 * `menu.contextTrigger()` element positioned at the pointer, a delegated
 * `contextmenu` listener that captures the row, and a `MenuList` that
 * dispatches the selected item to `onSelect`.
 *
 * Every admin/client row menu (`AdminOfferingsContextMenu`,
 * `ClientsContextMenu`, …) is just a `clientEntry` wrapping this factory with
 * its own label, table, items, and actions.
 */
export function createRowContextMenu(options: RowContextMenuOptions) {
  return function RowContextMenu(handle: Handle) {
    let target: RowMenuTarget | null = null

    return () => (
      <menu.Context label={options.label}>
        <div
          mix={[
            menu.contextTrigger(),
            ref((el) => {
              let table = document.querySelector(options.tableSelector)
              if (!table) return

              function onContextMenu(event: Event) {
                let mouseEvent = event as MouseEvent
                mouseEvent.preventDefault()

                let element = mouseEvent.target as HTMLElement | null
                let row = element?.closest?.('[data-row-id]') as HTMLElement | null
                if (!row) return // header, pagination, or empty space

                target = { rowId: row.dataset.rowId ?? '', row }
                if (options.reactive) void handle.update()

                el.style.left = mouseEvent.clientX + 'px'
                el.style.top = mouseEvent.clientY + 'px'

                // Dispatch a synthetic contextmenu; the contextTrigger mixin
                // picks up the coordinates and opens the menu.
                el.dispatchEvent(
                  new MouseEvent('contextmenu', {
                    clientX: mouseEvent.clientX,
                    clientY: mouseEvent.clientY,
                    bubbles: true,
                    cancelable: true,
                  }),
                )
              }

              table.addEventListener('contextmenu', onContextMenu)

              handle.signal.addEventListener('abort', () => {
                table.removeEventListener('contextmenu', onContextMenu)
              })

              // Hydration signal for e2e: the clientEntry attaches this listener
              // asynchronously, so tests wait for the attribute before
              // right-clicking to avoid a hydration race.
              el.dataset.rowContextMenuReady = 'true'
            }),
            hiddenTrigger,
          ]}
        />

        <MenuList
          mix={onMenuSelect((event) => {
            let captured = target
            if (!captured || !captured.rowId) return
            options.onSelect(event.item.name, captured, handle)
          })}
        >
          {options.items(target)}
        </MenuList>
      </menu.Context>
    )
  }
}

/** Where a row menu's Edit (or config) action navigates. */
export interface GridNavigation {
  /** id of the page's `<script type="application/json">` grid-state blob. */
  stateElementId: string
  /** Base href used when the blob is absent or carries no `baseHref`. */
  fallbackBaseHref: string
  /** Sort applied when the blob carries no sort (the page's server default). */
  defaultSort: string
}

/**
 * Read the page's grid-state blob, append a navigation parameter (e.g.
 * `editing`), and frame-navigate. Uses the same `gridStateToParams` ordering
 * the server uses, and falls back to the bare `?<param>=<value>` URL when the
 * blob is missing or malformed.
 */
export function navigateGridParam(
  handle: Handle,
  navigation: GridNavigation,
  paramName: string,
  paramValue: string,
): void {
  let dataElement = document.getElementById(navigation.stateElementId)
  if (!dataElement) return

  try {
    let raw = JSON.parse(dataElement.textContent || '{}') as Partial<GridState> & {
      baseHref?: string
    }
    let state: GridState = {
      offset: raw.offset ?? '',
      sort: raw.sort || navigation.defaultSort,
      order: raw.order || 'asc',
      filter: raw.filter ?? '',
      period: raw.period,
      status: raw.status,
    }
    let params = new URLSearchParams()
    params.set(paramName, paramValue)
    for (let [key, value] of gridStateToParams(state)) {
      params.set(key, value)
    }
    let baseHref = raw.baseHref || navigation.fallbackBaseHref
    safeNavigate(baseHref + '?' + params.toString(), handle)
  } catch {
    safeNavigate(navigation.fallbackBaseHref + '?' + paramName + '=' + paramValue, handle)
  }
}

/** Submit the row's server-rendered form identified by `data-<attribute>=<rowId>`. */
export function submitRowForm(rowId: string, attribute: string): void {
  let form = document.querySelector<HTMLFormElement>(`form[${attribute}="${rowId}"]`)
  if (form) form.requestSubmit()
}

/** Confirm with `message`, then submit the row's form. */
export function confirmAndSubmitRowForm(
  rowId: string,
  message: string,
  attribute = 'data-delete-form',
): void {
  if (!confirm(message)) return
  submitRowForm(rowId, attribute)
}

/**
 * Confirm using the row form's own `data-confirm` message (falling back to
 * `message`), then submit. A missing form means no prompt and no submit — the
 * behaviour the appointments menu relies on.
 */
export function confirmFromFormAndSubmit(
  rowId: string,
  message: string,
  attribute = 'data-delete-form',
): void {
  let form = document.querySelector<HTMLFormElement>(`form[${attribute}="${rowId}"]`)
  if (!form) return
  if (!confirm(form.getAttribute('data-confirm') || message)) return
  form.requestSubmit()
}
