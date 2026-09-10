import { clientEntry, type Handle, on, css, ref } from 'remix/ui'
import { theme } from '../../../ui/theme/theme.ts'
import { moveItemInArray, findTypeaheadTarget } from '../../../utils/lists-keyboard.ts'
import { Glyph } from '../../../ui/theme/glyph/glyph.tsx'
import { frames } from '../../../routes.ts'

import button from '../../../ui/theme/button.ts'
import { resolveDropZone, type RectLike, type SidebarRowRect } from './drop-zone.ts'
import { syncSidebarRow } from './sidebar-sync.ts'

type ItemPriority = 'low' | 'medium' | 'high'
type SortMode = 'manual' | 'az' | 'done' | 'updated'

type ListItem = {
  id: string
  label: string
  done?: boolean
  priority?: ItemPriority
  due?: string
  tags?: string[]
  updatedAt?: number
}

type ListInitialState = {
  id: number
  title: string
  description: string
  items: ListItem[]
  updated_at: number
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const ListsClient = clientEntry(
  import.meta.url + '#ListsClient',
  function ListsClient(handle: Handle<{ initialState?: ListInitialState | null }>) {
    let items: ListItem[] = []
    let title = ''
    let description = ''
    let newItemLabel = ''
    let listFilter = ''
    // Description visibility. 'auto' shows the field only when the list has a
    // description, 'open' forces it visible, 'closed' hides it even when filled.
    // Resets to 'auto' on every list load so switching lists always reflects the
    // new list's own content.
    let descriptionMode: 'auto' | 'open' | 'closed' = 'auto'
    let loadedListId: number | null = null
    let loadedUpdatedAt: number | null = null
    let saving = false
    let loadError = ''
    let editingIndex: number | null = null
    let editText = ''
    let editPriority: '' | ItemPriority = ''
    let editDue = ''
    let editTags = ''
    let newItemRef: HTMLTextAreaElement | null = null
    let filterInputRef: HTMLInputElement | null = null
    let listRef: HTMLDivElement | null = null
    let copyFormRef: HTMLFormElement | null = null
    let copyCsrfRef: HTMLInputElement | null = null
    // The title/description fields are uncontrolled (the user's typing owns the
    // DOM value), so `defaultValue` no longer applies once they have been
    // edited. Without these refs, switching to another list kept showing the
    // previous list's title/description — a stale header that could be written
    // into the newly opened list on the next keystroke. `syncFieldInputs()`
    // pushes the newly hydrated state back into the DOM on every list load.
    let titleInputRef: HTMLInputElement | null = null
    let descriptionInputRef: HTMLTextAreaElement | null = null
    let initialized = false

    // Drag state
    let dragIndex: number | null = null
    let dropIndex: number | null = null
    let draggedEl: HTMLElement | null = null
    let indicatorEl: HTMLElement | null = null

    // Cross-list drag state (sidebar rows as drop targets)
    let sidebarHighlightEl: HTMLElement | null = null
    let editorRect: RectLike | null = null
    let sidebarRows: SidebarRowRect[] = []
    let sidebarDragCleanup: (() => void) | null = null

    // List-to-list drag state (sidebar rows as draggable sources)
    let dragKind: 'item' | 'list' | null = null
    let draggedListId: number | null = null
    let listDragCleanup: (() => void) | null = null

    // Keyboard navigation state
    let focusedId: string | null = null
    let grabbedId: string | null = null
    let liveRegion: HTMLElement | null = null

    // Autosave state
    type SaveStatus = 'saved' | 'saving' | 'dirty' | 'error'
    let saveStatus: SaveStatus = 'saved'
    let autosaveTimer: ReturnType<typeof setTimeout> | null = null

    // Conflict state
    type ConflictState = { show: boolean; serverState: ListInitialState | null }
    let conflictState: ConflictState = { show: false, serverState: null }

    // Undo + inline-confirm state
    let undoSnapshot: ListItem[] | null = null
    let undoTimer: ReturnType<typeof setTimeout> | null = null
    let undoKind: 'delete' | 'clear' | 'clearDone' | 'reorder' | null = null
    let clearArmed = false
    let clearArmTimer: ReturnType<typeof setTimeout> | null = null

    let clearUndo = () => {
      if (undoTimer) clearTimeout(undoTimer)
      undoTimer = null
      undoSnapshot = null
      undoKind = null
      handle.update()
    }

    let showUndo = (kind: 'delete' | 'clear' | 'clearDone' | 'reorder', snapshot: ListItem[]) => {
      if (undoTimer) clearTimeout(undoTimer)
      undoSnapshot = snapshot
      undoKind = kind
      handle.update()
      undoTimer = setTimeout(() => {
        undoSnapshot = null
        undoKind = null
        undoTimer = null
        handle.update()
      }, 6000)
    }

    let undo = () => {
      if (undoSnapshot === null) return
      items = undoSnapshot.map((item) => ({ ...item }))
      clearUndo()
      setDirty()
      announce('Rückgängig gemacht')
      handle.update()
      scheduleAutosave(true)
    }

    let disarmClear = () => {
      if (clearArmTimer) clearTimeout(clearArmTimer)
      clearArmTimer = null
      if (clearArmed) {
        clearArmed = false
        handle.update()
      }
    }

    // Track whether items, title or description are dirty
    let cleanTitle = ''
    let cleanDescription = ''
    let cleanItemsJSON = ''
    let snapshotClean = () => {
      cleanTitle = title
      cleanDescription = description
      cleanItemsJSON = JSON.stringify(items)
    }
    let isDirty = () =>
      title !== cleanTitle ||
      description !== cleanDescription ||
      JSON.stringify(items) !== cleanItemsJSON

    // ── In-list search (view-only filter) ───────────────────────────────────
    // The filter narrows only what is rendered. Mutations always target the
    // real `items` array through the visible→real index mapping, so toggling,
    // editing and deleting hit the correct item. Position-based reordering
    // (drag + keyboard grab + up/down buttons) is disabled while a filter is
    // active, because moving "up/down" inside a filtered subset is ambiguous.
    let filterActive = (): boolean => listFilter.trim() !== ''
    let visibleItems = (): ListItem[] => {
      let q = listFilter.trim().toLowerCase()
      return q ? items.filter((item) => item.label.toLowerCase().includes(q)) : items
    }
    // Reset the in-list filter. Called on every reload/hydrate because the
    // client entry is not remounted on frame navigation, so the filter would
    // otherwise persist across switching to a different list.
    let clearFilter = () => {
      listFilter = ''
      if (filterInputRef) filterInputRef.value = ''
    }

    // Push the current `title`/`description` state into the uncontrolled
    // title/description DOM nodes. Must run after every hydration/discard so the
    // header always reflects the list that is actually open.
    let syncFieldInputs = () => {
      if (titleInputRef && titleInputRef.value !== title) titleInputRef.value = title
      if (descriptionInputRef && descriptionInputRef.value !== description) {
        descriptionInputRef.value = description
      }
    }

    // The description field is collapsed for lists without one so the editor
    // spends its vertical space on the element rows instead.
    let showDescription = (): boolean =>
      descriptionMode === 'open' || (descriptionMode === 'auto' && description.trim() !== '')

    // ── Unsaved new-list draft ───────────────────────────────────────────────
    // A brand-new list (loadedListId === null) has no id, so the unload beacon
    // cannot flush it — navigating to another list silently discarded the draft.
    // Persist a session-scoped draft as we type and restore it when a fresh "new
    // list" is opened, so nothing typed is ever lost. It is cleared the moment
    // the list is saved (an id exists) or the user discards it.
    let DRAFT_KEY = 'lists:draft:new'
    let draftRestored = false

    let loadDraft = (): ListInitialState | null => {
      if (typeof sessionStorage === 'undefined') return null
      try {
        let raw = sessionStorage.getItem(DRAFT_KEY)
        if (!raw) return null
        let data = JSON.parse(raw)
        if (data && typeof data === 'object') {
          return {
            id: 0,
            title: typeof data.title === 'string' ? data.title : '',
            description: typeof data.description === 'string' ? data.description : '',
            items: Array.isArray(data.items) ? data.items : [],
            updated_at: 0,
          }
        }
      } catch {
        /* ignore a corrupt draft */
      }
      return null
    }

    let clearDraft = () => {
      if (typeof sessionStorage === 'undefined') return
      try {
        sessionStorage.removeItem(DRAFT_KEY)
      } catch {
        /* ignore */
      }
      draftRestored = false
    }

    let saveDraft = () => {
      if (loadedListId !== null) return
      if (typeof sessionStorage === 'undefined') return
      if (!isDirty()) {
        clearDraft()
        return
      }
      try {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ title, description, items }))
      } catch {
        /* storage full / unavailable — ignore */
      }
    }

    let setDirty = () => {
      // Runs before the dirty early-return so that reverting a new-list draft
      // back to clean clears the stored draft rather than leaving it stale.
      saveDraft()
      if (!isDirty()) return
      if (saveStatus === 'saved' || saveStatus === 'error') {
        saveStatus = 'dirty'
        handle.update()
      }
      scheduleAutosave()
    }

    // Discard a restored unsaved draft completely and reset to a clean new list.
    let discardDraft = () => {
      clearDraft()
      items = []
      title = ''
      description = ''
      descriptionMode = 'auto'
      loadedListId = null
      loadedUpdatedAt = null
      saveStatus = 'saved'
      loadError = ''
      conflictState = { show: false, serverState: null }
      snapshotClean()
      clearFilter()
      syncFieldInputs()
      handle.update()
    }

    let multilineDisplayStyle = css({
      // The label is a child of the column `itemMainStyle` now, so it must not
      // flex-grow: with flex-basis: 0% and overflow: hidden it collapses to 0px
      // and hides the text. It sizes to its content, clamped to two lines so one
      // long item can't eat three rows of height, and fills the column width via
      // the default align-self: stretch.
      fontSize: theme.fontSize.lg,
      color: theme.colors.text.primary,
      display: '-webkit-box',
      // Must be a *string*: the css() runtime appends `px` to numeric values for
      // every property outside its unitless allowlist, and `-webkit-line-clamp:
      // 2px` is invalid CSS that the browser silently drops — which is why the
      // clamp never took effect and long labels grew to five lines.
      WebkitLineClamp: '2',
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
      wordBreak: 'break-word',
      whiteSpace: 'pre-wrap',
    })

    let gripStyle = css({
      cursor: 'grab',
      padding: '0 6px',
      userSelect: 'none',
      color: theme.colors.text.secondary,
      fontSize: theme.fontSize.lg,
      lineHeight: 1,
      '&:active': {
        cursor: 'grabbing',
      },
      '&:hover': {
        color: theme.colors.text.primary,
      },
    })

    // Per-item metadata layout. The label + metadata line live in a flex column
    // so the badges wrap under the label instead of squeezing it sideways.
    let itemMainStyle = css({
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
    })

    let metaRowStyle = css({
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: theme.space.xs,
      marginTop: '0.25rem',
    })

    let metaBadgeStyle = css({
      display: 'inline-flex',
      alignItems: 'center',
      padding: '1px 7px',
      borderRadius: theme.radius.full,
      border: '1px solid transparent',
      fontSize: theme.fontSize.xs,
      lineHeight: 1.5,
      whiteSpace: 'nowrap',
    })

    let dueBadgeStyle = css({
      color: theme.colors.text.secondary,
      borderColor: theme.colors.border.default,
      backgroundColor: theme.surface.lvl2,
    })

    let tagChipStyle = css({
      color: theme.colors.text.primary,
      borderColor: theme.colors.border.default,
      backgroundColor: theme.surface.lvl2,
    })

    // Editing surface: the label textarea plus a metadata editor row
    // (priority / due date / tags), all inside the column that takes flex: 1.
    let editTextareaStyle = css({
      padding: `${theme.space.sm} ${theme.space.md}`,
      borderRadius: theme.radius.md,
      border: `1px solid ${theme.colors.focus.ring}`,
      width: '100%',
      boxSizing: 'border-box',
      fontSize: theme.fontSize.lg,
      outline: 'none',
      fontFamily: theme.fontFamily.sans,
      minHeight: '60px',
      resize: 'vertical',
      backgroundColor: theme.surface.lvl0,
      color: theme.colors.text.primary,
    })

    let metaEditorStyle = css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.space.sm,
      marginTop: theme.space.sm,
    })

    let metaFieldStyle = css({
      padding: `${theme.space.xs} ${theme.space.sm}`,
      borderRadius: theme.radius.sm,
      border: `1px solid ${theme.colors.border.strong}`,
      fontSize: theme.fontSize.xs,
      fontFamily: theme.fontFamily.sans,
      backgroundColor: theme.surface.lvl1,
      color: theme.colors.text.primary,
      outline: 'none',
      '&:focus': {
        borderColor: theme.colors.focus.ring,
        boxShadow: `0 0 0 3px ${theme.colors.focus.ring}33`,
      },
    })

    let priorityBadge = (p: ItemPriority) => {
      switch (p) {
        case 'high':
          return css({
            color: theme.colors.action.danger.background,
            borderColor: theme.colors.action.danger.border,
            backgroundColor: theme.colors.action.danger.background + '0f',
          })
        case 'medium':
          return css({ color: '#d69e2e', borderColor: '#d69e2e', backgroundColor: '#d69e2e14' })
        case 'low':
          return css({
            color: theme.colors.text.secondary,
            borderColor: theme.colors.border.strong,
            backgroundColor: theme.surface.lvl0,
          })
      }
    }
    let priorityLabel = (p: ItemPriority) =>
      p === 'high' ? 'Hoch' : p === 'medium' ? 'Mittel' : 'Niedrig'

    // ── Editor surface: a single centered card with a header + body ──────────
    let cardStyle = css({
      fontFamily: theme.fontFamily.sans,
      // Fill the content column (up to a cap) so the card uses the available
      // width instead of leaving a large gap on either side. `margin: 0 auto`
      // still centers it; the `calc(100% - 2rem)` keeps a small 1rem gutter on
      // each edge while the card never exceeds the cap.
      maxWidth: 'min(1000px, calc(100% - 2rem))',
      width: '100%',
      // Content-sized card: it hugs the editor's actual content so a short list
      // shows no dead space. `maxHeight: 100%` + the `lg` bottom margin caps it
      // at the sidebar's height (the flex column shrinks the card to fit), and
      // the `min-height: 0` chain below lets a long element list scroll
      // internally instead of overflowing the card.
      maxHeight: '100%',
      margin: `0 auto ${theme.space.lg}`,
      backgroundColor: theme.surface.lvl1,
      border: `1px solid ${theme.colors.border.default}`,
      borderRadius: theme.radius.xl,
      boxShadow: theme.shadow.sm,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
    })

    let cardHeaderStyle = css({
      display: 'flex',
      alignItems: 'flex-end',
      gap: theme.space.md,
      flexWrap: 'wrap',
      // Tighter vertical padding: the header's own 16px bottom padding stacked
      // on the body's 16px top padding left a flat ~33px band between the title
      // and the first body row.
      padding: `${theme.space.sm} ${theme.space.lg}`,
      borderBottom: `1px solid ${theme.colors.border.subtle}`,
      backgroundColor: theme.surface.lvl2,
    })

    let cardTitleWrapStyle = css({ flex: 1, minWidth: 0 })

    // Small eyebrow above the title so the editor always states which list is
    // open — the title field itself may be empty, and the sidebar selection is
    // easy to miss.
    let listContextStyle = css({
      display: 'block',
      marginBottom: theme.space.xs,
      fontSize: theme.fontSize.xs,
      fontWeight: theme.fontWeight.semibold,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: theme.colors.text.muted,
    })

    let titleHeadingStyle = css({ margin: 0, lineHeight: 1.2 })

    let titleInputStyle = css({
      width: '100%',
      padding: `0 0 ${theme.space.xs} 0`,
      border: 'none',
      borderBottom: '2px solid transparent',
      borderRadius: theme.radius.sm,
      fontSize: theme.fontSize.xl,
      fontWeight: theme.fontWeight.bold,
      outline: 'none',
      fontFamily: theme.fontFamily.sans,
      boxSizing: 'border-box',
      backgroundColor: 'transparent',
      color: theme.colors.text.primary,
      transition: 'border-color 120ms ease',
      '&:focus': {
        borderBottomColor: theme.colors.focus.ring,
      },
      '&::placeholder': {
        color: theme.colors.text.muted,
        fontWeight: theme.fontWeight.semibold,
      },
    })

    let visuallyHiddenStyle = css({
      position: 'absolute',
      width: '1px',
      height: '1px',
      overflow: 'hidden',
      clip: 'rect(0 0 0 0)',
      whiteSpace: 'nowrap',
    })

    let cardHeaderActionsStyle = css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.space.sm,
      flexShrink: 0,
    })

    let cardBodyStyle = css({
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      // Auto basis (not `flex: 1` = basis 0) so the body's content contributes
      // to the card's natural height (keeping the card content-sized), while it
      // still shrinks when tall so the element list can scroll internally.
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      // Tighter top padding so the first body row (the description or the
      // add-element field) sits close under the header instead of leaving a
      // band of empty card between the title and "Beschreibung".
      padding: theme.space.md,
      paddingTop: theme.space.sm,
    })

    // ── ELEMENTE panel toolbar ───────────────────────────────────────────────
    // A single compact row carrying the element filter, the reorder controls and
    // the item counter. These controls previously occupied a separate list
    // toolbar above the description plus a dedicated filter row, costing ~120px
    // of vertical space that now goes to element rows instead.
    let panelHeaderStyle = css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.space.sm,
      flexWrap: 'wrap',
      padding: `${theme.space.xs} ${theme.space.sm}`,
      backgroundColor: theme.surface.lvl2,
      borderBottom: `1px solid ${theme.colors.border.default}`,
    })

    let panelLeftStyle = css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.space.xs,
      flex: 1,
      minWidth: '160px',
    })

    let panelRightStyle = css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.space.xs,
      marginLeft: 'auto',
    })

    let panelFilterInputStyle = css({
      maxWidth: '260px',
    })

    // Compact square buttons for Umkehren / Mischen / Tastatur-Hilfe.
    let iconToolbarBtnStyle = css({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '26px',
      height: '26px',
      padding: 0,
      border: `1px solid ${theme.colors.border.strong}`,
      borderRadius: theme.radius.sm,
      background: theme.surface.lvl1,
      color: theme.colors.text.secondary,
      cursor: 'pointer',
      fontFamily: theme.fontFamily.sans,
      fontSize: theme.fontSize.sm,
      lineHeight: 1,
      ':hover': {
        background: theme.surface.lvl3,
        color: theme.colors.text.primary,
      },
    })

    // "…" overflow menu that holds the destructive list actions so they stay out
    // of the everyday toolbar and out of the way.
    let menuDetailsStyle = css({
      position: 'relative',
    })

    let menuSummaryStyle = css({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '26px',
      height: '26px',
      border: `1px solid ${theme.colors.border.strong}`,
      borderRadius: theme.radius.sm,
      background: theme.surface.lvl1,
      color: theme.colors.text.secondary,
      cursor: 'pointer',
      listStyle: 'none',
      fontSize: theme.fontSize.sm,
      userSelect: 'none',
      ':hover': {
        background: theme.surface.lvl3,
        color: theme.colors.text.primary,
      },
    })

    let menuPanelStyle = css({
      position: 'absolute',
      top: 'calc(100% + 4px)',
      right: 0,
      zIndex: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.space.xs,
      padding: theme.space.sm,
      minWidth: '230px',
      borderRadius: theme.radius.md,
      border: `1px solid ${theme.colors.border.default}`,
      backgroundColor: theme.surface.lvl1,
      boxShadow: theme.shadow.md,
    })

    let countTextStyle = css({
      fontSize: theme.fontSize.xs,
      color: theme.colors.text.secondary,
      whiteSpace: 'nowrap',
    })

    // "Alle löschen" is quiet (danger-coloured text on a neutral button) until
    // the first click arms it, at which point it turns into a solid danger
    // button so the confirmation is impossible to miss.
    let dangerTextStyle = css({
      color: theme.colors.action.danger.background,
    })

    let dangerArmedStyle = css({
      backgroundColor: theme.colors.action.danger.background,
      borderColor: theme.colors.action.danger.background,
      color: theme.colors.action.danger.foreground,
    })

    let sortSelectStyle = css({
      padding: `${theme.space.xs} ${theme.space.sm}`,
      borderRadius: theme.radius.sm,
      border: `1px solid ${theme.colors.border.strong}`,
      fontSize: theme.fontSize.xs,
      backgroundColor: theme.surface.lvl1,
      color: theme.colors.text.primary,
      cursor: 'pointer',
      fontFamily: theme.fontFamily.sans,
      maxWidth: '150px',
      '&:focus': {
        outline: 'none',
        borderColor: theme.colors.focus.ring,
        boxShadow: `0 0 0 3px ${theme.colors.focus.ring}33`,
      },
    })

    // In-list search lives inline in the ELEMENTE toolbar; Escape clears it.
    let filterInputStyle = css({
      width: '100%',
      minWidth: 0,
      padding: `${theme.space.xs} ${theme.space.sm}`,
      borderRadius: theme.radius.sm,
      border: `1px solid ${theme.colors.border.strong}`,
      fontSize: theme.fontSize.xs,
      outline: 'none',
      fontFamily: theme.fontFamily.sans,
      boxSizing: 'border-box',
      backgroundColor: theme.surface.lvl1,
      color: theme.colors.text.primary,
      '&:focus': {
        borderColor: theme.colors.focus.ring,
        boxShadow: `0 0 0 3px ${theme.colors.focus.ring}33`,
      },
      '&::placeholder': {
        color: theme.colors.text.muted,
      },
    })

    // ── Collapsible description ──────────────────────────────────────────────
    // Hidden for lists without a description so the space goes to element rows.
    let descriptionHeadStyle = css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.space.sm,
      marginBottom: theme.space.xs,
    })

    let descriptionLabelStyle = css({
      fontSize: theme.fontSize.xs,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.text.muted,
    })

    let collapseBtnStyle = css({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '20px',
      height: '20px',
      padding: 0,
      border: 'none',
      background: 'transparent',
      color: theme.colors.text.muted,
      cursor: 'pointer',
      borderRadius: theme.radius.sm,
      fontSize: theme.fontSize.xs,
      ':hover': {
        background: theme.surface.lvl2,
        color: theme.colors.text.primary,
      },
    })

    let descriptionTextareaStyle = css({
      width: '100%',
      padding: `${theme.space.xs} ${theme.space.sm}`,
      borderRadius: theme.radius.md,
      border: `1px solid ${theme.colors.border.strong}`,
      fontSize: theme.fontSize.sm,
      outline: 'none',
      fontFamily: theme.fontFamily.sans,
      boxSizing: 'border-box',
      backgroundColor: theme.surface.lvl0,
      color: theme.colors.text.primary,
      minHeight: '38px',
      resize: 'vertical',
      '&:focus': {
        borderColor: theme.colors.focus.ring,
        boxShadow: `0 0 0 3px ${theme.colors.focus.ring}33`,
      },
      '&::placeholder': {
        color: theme.colors.text.muted,
      },
    })

    let showDescriptionBtnStyle = css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.space.xs,
      padding: `${theme.space.xs} ${theme.space.sm}`,
      border: 'none',
      background: 'transparent',
      color: theme.colors.text.muted,
      cursor: 'pointer',
      borderRadius: theme.radius.sm,
      fontSize: theme.fontSize.xs,
      fontFamily: theme.fontFamily.sans,
      ':hover': {
        background: theme.surface.lvl2,
        color: theme.colors.text.primary,
      },
    })

    let clearFilterBtnStyle = css({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '22px',
      height: '22px',
      padding: 0,
      flexShrink: 0,
      border: 'none',
      background: 'transparent',
      color: theme.colors.text.muted,
      cursor: 'pointer',
      borderRadius: theme.radius.sm,
      fontSize: theme.fontSize.xs,
      ':hover': {
        background: theme.surface.lvl2,
        color: theme.colors.text.primary,
      },
    })

    // Item row action cluster is hidden until the row is hovered/focused. It is
    // absolutely positioned over the right edge of the row so the row content
    // (the label) can span the full row width — the actions never consume layout
    // space, letting rows be longer. The buttons are joined into a flat button
    // group (matching /admin/lists): square, shared border, rounded only on the
    // outer corners. Each button carries its own style (the remix-ui css()
    // runtime won't emit descendant `> button` group selectors, so we apply the
    // styles per-button instead of via a container rule).
    let itemActionsStyle = css({
      position: 'absolute',
      top: '50%',
      right: theme.space.sm,
      transform: 'translateY(-50%)',
      display: 'inline-flex',
      alignItems: 'stretch',
      opacity: 0,
      pointerEvents: 'none',
      transition: 'opacity 0.12s ease',
      // On touch devices there is no hover, so the reveal-on-hover cluster would
      // be unreachable — keep the row actions visible and interactive instead.
      '@media (hover: none)': {
        opacity: 1,
        pointerEvents: 'auto',
      },
    })

    // Flat square button-group member — mirrors /admin/lists' iconActionStyle.
    // Every button drops its right border so adjacent buttons share one. Radius
    // is applied separately (first = left, last = right) so middle buttons stay
    // perfectly square.
    let iconActionStyle = css({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '30px',
      height: '30px',
      padding: 0,
      border: `1px solid ${theme.colors.border.default}`,
      borderRight: 'none',
      background: theme.surface.lvl2,
      color: theme.colors.text.secondary,
      cursor: 'pointer',
      '&:hover': { background: theme.surface.lvl3, color: theme.colors.text.primary },
      '&:disabled': { opacity: 0.4, cursor: 'not-allowed' },
    })

    // First button in the group gets the left radius.
    let iconActionFirstStyle = css({
      borderRadius: `${theme.radius.md} 0 0 ${theme.radius.md}`,
    })

    // Last button in the group restores its right border + right radius.
    let iconActionLastStyle = css({
      borderRight: `1px solid ${theme.colors.border.default}`,
      borderRadius: `0 ${theme.radius.md} ${theme.radius.md} 0`,
    })

    // Danger (delete) button — mirrors /admin/lists' iconActionDangerStyle.
    let iconActionDangerStyle = css({
      color: theme.colors.action.danger.background,
      '&:hover': {
        background: theme.colors.action.danger.background,
        color: theme.colors.action.danger.foreground,
      },
    })

    let scrollToBottom = () => {
      if (listRef) {
        listRef.scrollTop = listRef.scrollHeight
      }
    }

    function navigateFrame(href: string) {
      handle.frame.src = href
      handle.frame.reload().catch(() => {})
    }

    let getCsrfHeaders = (): Record<string, string> => {
      let csrfToken =
        typeof document !== 'undefined'
          ? document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
          : undefined
      let headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (csrfToken) headers['X-Csrf-Token'] = csrfToken
      if (loadedUpdatedAt !== null) headers['If-Match'] = String(loadedUpdatedAt)
      return headers
    }

    let saveNow = async (manual = false): Promise<boolean> => {
      conflictState = { show: false, serverState: null }
      if (loadedListId === null) {
        // A brand-new list is created only by an explicit user action (the
        // "+ Liste hinzufügen" button). Autosave must never materialize a list
        // on its own, or a half-typed list silently appears and navigates away.
        if (!manual) {
          return false
        }
        // Don't create a nameless list: require a title or a description.
        // Items are optional — a list may be created empty and filled in later.
        if (!title.trim() && !description.trim()) {
          return false
        }
        // Create new list
        saving = true
        saveStatus = 'saving'
        handle.update()
        let ok = false
        let newId: number | null = null
        try {
          let response = await fetch('/lists', {
            method: 'POST',
            headers: getCsrfHeaders(),
            body: JSON.stringify({ title, description, items }),
          })
          if (response.ok) {
            let data = await response.json()
            newId = typeof data.id === 'number' ? data.id : null
            ok = true
            if (newId !== null) {
              loadedListId = newId
              loadedUpdatedAt = typeof data.updated_at === 'number' ? data.updated_at : null
            }
          } else {
            loadError = 'Speichern fehlgeschlagen'
          }
        } catch {
          loadError = 'Speichern fehlgeschlagen (Netzwerkfehler)'
        }
        saving = false
        if (ok && newId !== null) {
          snapshotClean()
          clearDraft()
          saveStatus = 'saved'
          handle.update()
          navigateFrame(`/lists?load=${newId}`)
          return true
        } else {
          saveStatus = 'error'
          handle.update()
          return false
        }
      } else {
        // Patch existing list
        saving = true
        saveStatus = 'saving'
        handle.update()
        // Capture snapshot at send time to detect drift during the await
        let sentTitle = title
        let sentDesc = description
        let sentItemsJSON = JSON.stringify(items)
        let ok = false
        try {
          let partial: Record<string, unknown> = {}
          if (isDirty()) {
            if (title !== cleanTitle) partial.title = title
            if (description !== cleanDescription) partial.description = description
            if (sentItemsJSON !== cleanItemsJSON) partial.items = items
          } else {
            // Fall back to sending full if nothing explicitly changed
            partial = { title, description, items }
          }
          let response = await fetch(`/lists/${loadedListId}`, {
            method: 'PUT',
            headers: getCsrfHeaders(),
            body: JSON.stringify(partial),
          })
          if (response.ok) {
            let data = await response.json()
            loadedUpdatedAt = typeof data.updated_at === 'number' ? data.updated_at : null
            // If the user kept typing during the save, mark dirty and reschedule
            let drifted =
              title !== sentTitle ||
              description !== sentDesc ||
              JSON.stringify(items) !== sentItemsJSON
            if (drifted) {
              saveStatus = 'dirty'
              scheduleAutosave()
              ok = true
              saving = false
              handle.update()
              return true
            }
            // Apply server echo only if nothing drifted
            if (data.items) items = data.items
            if (data.title !== undefined) title = data.title
            if (data.description !== undefined) description = data.description
            ok = true
          } else if (response.status === 409) {
            let server = await response.json()
            conflictState = {
              show: true,
              serverState: {
                id: server.id,
                title: server.title,
                description: server.description,
                items: server.items,
                updated_at: server.updated_at,
              },
            }
            ok = false
          } else {
            loadError = 'Aktualisieren fehlgeschlagen'
          }
        } catch {
          loadError = 'Aktualisieren fehlgeschlagen (Netzwerkfehler)'
        }
        saving = false
        if (ok) {
          snapshotClean()
          saveStatus = 'saved'
          syncEditorSidebar()
          handle.update()
          return true
        } else {
          saveStatus = 'error'
          handle.update()
          return false
        }
      }
    }

    // Push the current editor state into the matching sidebar row so the
    // sidebar's title / count stay in sync without a full frame reload.
    let syncEditorSidebar = () => {
      if (loadedListId === null) return
      let label = title.trim() || description.trim() || `Liste #${loadedListId}`
      syncSidebarRow(loadedListId, {
        label,
        count: items.length,
        doneCount: items.filter((item) => item.done === true).length,
        updatedAt: loadedUpdatedAt ?? undefined,
      })
    }

    let scheduleAutosave = (fast = false) => {
      if (conflictState.show) return
      if (autosaveTimer) clearTimeout(autosaveTimer)
      autosaveTimer = setTimeout(
        async () => {
          autosaveTimer = null
          if (!isDirty()) return
          // Re-check conflict before saving
          if (conflictState.show) return
          await saveNow()
        },
        fast ? 300 : 1500,
      )
    }

    let flushNow = async (): Promise<boolean> => {
      if (autosaveTimer) {
        clearTimeout(autosaveTimer)
        autosaveTimer = null
      }
      // If a save is already in flight, wait for it to settle before deciding.
      while (saving) {
        await new Promise<void>((resolve) => setTimeout(resolve, 10))
      }
      if (conflictState.show) return false
      if (!isDirty()) return true
      return await saveNow()
    }

    // Revert unsaved edits back to the last saved snapshot.
    let discardChanges = () => {
      if (autosaveTimer) {
        clearTimeout(autosaveTimer)
        autosaveTimer = null
      }
      if (undoTimer) {
        clearTimeout(undoTimer)
        undoTimer = null
      }
      undoSnapshot = null
      undoKind = null
      items = JSON.parse(cleanItemsJSON)
      title = cleanTitle
      description = cleanDescription
      descriptionMode = 'auto'
      saveStatus = 'saved'
      conflictState = { show: false, serverState: null }
      clearDraft()
      syncFieldInputs()
      handle.update()
    }

    // Hydrate from server-injected initial state
    let hydrateFromInitialState = (state: ListInitialState) => {
      items = state.items.map((item) => ({ ...item }))
      title = state.title ?? ''
      description = state.description
      descriptionMode = 'auto'
      loadedListId = state.id
      loadedUpdatedAt = state.updated_at
      snapshotClean()
      saveStatus = 'saved'
      loadError = ''
      loadingList = false
      conflictState = { show: false, serverState: null }
      clearFilter()
      syncFieldInputs()
    }

    // Initialize from initial state
    let loadingList = false
    if (handle.props.initialState) {
      hydrateFromInitialState(handle.props.initialState)
      initialized = true
    }

    // Reload handler: re-reads initial state from the new frame document
    function reloadFromFrame() {
      if (handle.signal.aborted) return
      if (typeof document === 'undefined') return
      let el = document.getElementById('lists-initial-state')
      if (el) {
        let raw = el.getAttribute('data-state')
        if (raw) {
          try {
            let data = JSON.parse(raw)
            if (data && typeof data.id === 'number') {
              hydrateFromInitialState(data)
              handle.update()
              return
            }
          } catch {
            // ignore parse errors, fall through to new-list state
          }
        }
      }
      // No initial state: start new
      // Restore an unsaved new-list draft if one exists, so a dismissed or
      // navigated-away draft is recovered instead of silently lost.
      let draft = loadDraft()
      if (draft) {
        items = draft.items.map((item) => ({ ...item }))
        title = draft.title ?? ''
        description = draft.description ?? ''
        descriptionMode = 'auto'
        loadedListId = null
        loadedUpdatedAt = null
        saveStatus = 'dirty'
        loadError = ''
        loadingList = false
        conflictState = { show: false, serverState: null }
        draftRestored = true
        clearFilter()
        syncFieldInputs()
        handle.update()
        return
      }
      items = []
      title = ''
      description = ''
      descriptionMode = 'auto'
      loadedListId = null
      loadedUpdatedAt = null
      saveStatus = 'saved'
      loadError = ''
      loadingList = false
      conflictState = { show: false, serverState: null }
      snapshotClean()
      clearFilter()
      syncFieldInputs()
      handle.update()
    }

    // Listen for frame reloads
    handle.frame.addEventListener('reloadComplete', reloadFromFrame, { signal: handle.signal })

    // Flush pending edits *before* the frame swaps in the next list.
    //
    // `beforeunload` never fires for a frame navigation (the document is not
    // unloaded), so switching list / searching / paginating used to silently
    // discard anything typed within the 1.5s autosave debounce. `reloadStart`
    // fires synchronously before the new content is fetched, while
    // `loadedListId`/`clean*` still describe the outgoing list — the only point
    // where the edit can still be attributed to the right row.
    function flushBeforeFrameReload() {
      flushWithKeepalive()
    }
    handle.frame.addEventListener('reloadStart', flushBeforeFrameReload, {
      signal: handle.signal,
    })

    // On init, if no initial state was already provided, wait for frame load
    if (!initialized) {
      setTimeout(() => {
        reloadFromFrame()
      }, 0)
    }

    // Drag-and-drop handlers (unchanged logic, just no id rewriting)
    let clearDragOver = () => {
      if (draggedEl) {
        draggedEl.style.opacity = ''
        draggedEl = null
      }
      if (indicatorEl) {
        indicatorEl.style.borderTop = ''
        indicatorEl.style.borderBottom = ''
        indicatorEl = null
      }
    }

    let handleDragStart = (e: DragEvent, index: number) => {
      let target = e.target as HTMLElement
      if (target.closest('button, input, textarea, [contenteditable]')) {
        e.preventDefault()
        return
      }
      if (filterActive()) {
        e.preventDefault()
        return
      }
      dragKind = 'item'
      dragIndex = index
      dropIndex = null
      e.dataTransfer!.effectAllowed = 'move'
      e.dataTransfer!.setData('text/plain', index.toString())
      let el = e.currentTarget as HTMLElement
      draggedEl = el
      el.style.opacity = '0.4'
      clearSidebarHighlight()
      measureDropZones()
      startSidebarDragWiring()
    }

    let elByIndex = (i: number): HTMLElement | null => {
      let child = listRef?.children[i]
      return child instanceof HTMLElement ? child : null
    }

    let showIndicator = (pos: number) => {
      if (indicatorEl) {
        indicatorEl.style.borderTop = ''
        indicatorEl.style.borderBottom = ''
        indicatorEl = null
      }
      dropIndex = pos
      let isNoop = dragIndex !== null && (dropIndex === dragIndex || dropIndex === dragIndex + 1)
      if (isNoop) return
      if (dropIndex < items.length) {
        let el = elByIndex(dropIndex)
        if (el) {
          el.style.borderTop = `2px solid ${theme.colors.focus.ring}`
          indicatorEl = el
        }
      } else if (dropIndex === items.length && items.length > 0) {
        let el = elByIndex(items.length - 1)
        if (el) {
          el.style.borderBottom = `2px solid ${theme.colors.focus.ring}`
          indicatorEl = el
        }
      }
    }

    let handleDragOver = (e: DragEvent, index: number) => {
      e.preventDefault()
      e.stopPropagation()
      if (dragIndex === null) return
      let rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      let midY = rect.top + rect.height / 2
      let newDropIndex = e.clientY < midY ? index : index + 1
      let isNoop = newDropIndex === dragIndex || newDropIndex === dragIndex + 1
      e.dataTransfer!.dropEffect = isNoop ? 'none' : 'move'
      if (newDropIndex === dropIndex) return
      showIndicator(newDropIndex)
    }

    let handleContainerDragOver = (e: DragEvent) => {
      e.preventDefault()
      if (dragIndex === null || items.length === 0) return
      let newDropIndex = items.length
      for (let i = 0; i < items.length; i++) {
        let el = elByIndex(i)
        if (!el) continue
        let rect = el.getBoundingClientRect()
        if (e.clientY < rect.top + rect.height / 2) {
          newDropIndex = i
          break
        }
      }
      let isNoop = newDropIndex === dragIndex || newDropIndex === dragIndex + 1
      e.dataTransfer!.dropEffect = isNoop ? 'none' : 'move'
      if (newDropIndex === dropIndex) return
      showIndicator(newDropIndex)
    }

    // Scroll the element list toward a pointer near its top/bottom edge during a
    // drag, so an item can be reordered to a position far below the fold.
    let autoScrollList = (clientY: number) => {
      if (!listRef) return
      let rect = listRef.getBoundingClientRect()
      let edge = 48
      if (clientY < rect.top + edge) {
        listRef.scrollTop -= 14
      } else if (clientY > rect.bottom - edge) {
        listRef.scrollTop += 14
      }
    }

    let handleDrop = (e: DragEvent) => {
      e.preventDefault()
      clearDragOver()
      if (dragIndex === null || dropIndex === null) {
        dragIndex = null
        dropIndex = null
        return
      }
      if (dropIndex === dragIndex || dropIndex === dragIndex + 1) {
        dragIndex = null
        dropIndex = null
        return
      }
      let newItems = [...items]
      let [removed] = newItems.splice(dragIndex, 1)
      let adjustedDrop = dropIndex > dragIndex ? dropIndex - 1 : dropIndex
      newItems.splice(adjustedDrop, 0, removed!)
      items = newItems
      dragIndex = null
      dropIndex = null
      setDirty()
      handle.update()
    }

    // Cross-list drag: sidebar rows as drop targets
    let rectOf = (el: HTMLElement): RectLike => {
      let r = el.getBoundingClientRect()
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }
    }

    let measureDropZones = () => {
      editorRect = listRef ? rectOf(listRef) : null
      sidebarRows = Array.from(document.querySelectorAll<HTMLElement>('[data-list-id]'))
        .map((el) => ({ listId: Number(el.dataset.listId), rect: rectOf(el) }))
        .filter((row) => Number.isFinite(row.listId))
    }

    let showSidebarHighlight = (listId: number) => {
      if (sidebarHighlightEl) sidebarHighlightEl.style.boxShadow = ''
      let row = Array.from(document.querySelectorAll<HTMLElement>('[data-list-id]')).find(
        (el) => Number(el.dataset.listId) === listId,
      )
      sidebarHighlightEl = row ?? null
      if (row) row.style.boxShadow = `inset 0 0 0 2px ${theme.colors.focus.ring}`
    }

    let clearSidebarHighlight = () => {
      if (sidebarHighlightEl) {
        sidebarHighlightEl.style.boxShadow = ''
        sidebarHighlightEl = null
      }
    }

    let startSidebarDragWiring = () => {
      stopSidebarDragWiring()
      let ac = new AbortController()
      window.addEventListener(
        'dragover',
        (e) => {
          let zone = resolveDropZone(e.clientX, e.clientY, editorRect, sidebarRows)
          if (zone.zone === 'none') return
          e.preventDefault()
          if (zone.zone === 'editor') {
            clearSidebarHighlight()
          } else {
            // Dismiss only the intra-list indicator — keep the dragged item lifted.
            if (indicatorEl) {
              indicatorEl.style.borderTop = ''
              indicatorEl.style.borderBottom = ''
              indicatorEl = null
            }
            dropIndex = null
            showSidebarHighlight(zone.listId)
          }
        },
        { capture: true, signal: ac.signal },
      )
      for (let row of Array.from(document.querySelectorAll<HTMLElement>('[data-list-id]'))) {
        row.addEventListener('drop', (e) => handleSidebarDrop(e as DragEvent, row), {
          signal: ac.signal,
        })
      }
      sidebarDragCleanup = () => ac.abort()
    }

    let stopSidebarDragWiring = () => {
      if (sidebarDragCleanup) {
        sidebarDragCleanup()
        sidebarDragCleanup = null
      }
    }

    let handleSidebarDrop = async (e: DragEvent, row: HTMLElement) => {
      e.preventDefault()
      e.stopPropagation()
      if (dragIndex === null) return
      let targetId = Number(row.dataset.listId)
      let sourceId = loadedListId
      let item = items[dragIndex]
      dragIndex = null
      dropIndex = null
      clearSidebarHighlight()
      clearDragOver()
      stopSidebarDragWiring()
      if (sourceId === null || !Number.isFinite(targetId) || !item) {
        handle.update()
        return
      }
      if (targetId === sourceId) {
        loadError = 'Element kann nicht in dieselbe Liste verschoben werden'
        handle.update()
        return
      }

      // Persist any pending edits first so the reload reads a consistent row.
      let flushed = await flushNow()
      if (!flushed) {
        handle.update()
        return
      }

      try {
        let response = await fetch(`/lists/${sourceId}/move`, {
          method: 'POST',
          headers: getCsrfHeaders(),
          body: JSON.stringify({ targetId, itemId: item.id }),
        })
        if (response.ok) {
          handle.frame.reload().catch(() => {})
        } else if (response.status === 409) {
          let server = await response.json()
          conflictState = {
            show: true,
            serverState: {
              id: server.id,
              title: server.title,
              description: server.description,
              items: server.items,
              updated_at: server.updated_at,
            },
          }
          handle.update()
        } else {
          loadError = 'Verschieben fehlgeschlagen'
          handle.update()
        }
      } catch {
        loadError = 'Verschieben fehlgeschlagen (Netzwerkfehler)'
        handle.update()
      }
    }

    // ── List-to-list drag (sidebar rows as draggable sources) ────────────────
    // Dropping list A on list B copies A's items into B (fresh ids), leaving A
    // intact. Distinct from the item drag above: it uses a dedicated
    // dataTransfer type and never assigns `dragIndex`, so the editor's item
    // drop handlers (which bail on `dragIndex === null`) ignore it.
    let stopListDragWiring = () => {
      if (listDragCleanup) {
        listDragCleanup()
        listDragCleanup = null
      }
    }

    let cleanupListDrag = () => {
      clearSidebarHighlight()
      stopListDragWiring()
      draggedListId = null
      if (dragKind === 'list') dragKind = null
    }

    let parseListCount = (row: HTMLElement | null | undefined): number | null => {
      if (!row) return null
      let text = row.querySelector('[data-list-count]')?.textContent?.trim() ?? ''
      let match = text.match(/(\d+)\s*$/)
      return match ? Number(match[1]) : null
    }

    let handleListDragOver = (e: DragEvent, row: HTMLElement) => {
      if (dragKind !== 'list' || draggedListId === null) return
      let targetId = Number(row.dataset.listId)
      if (!Number.isFinite(targetId) || targetId === draggedListId) {
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'none'
        clearSidebarHighlight()
        return
      }
      e.preventDefault()
      e.stopPropagation()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
      showSidebarHighlight(targetId)
    }

    let startListDragWiring = () => {
      stopListDragWiring()
      let ac = new AbortController()
      // Clear the highlight when the pointer leaves every sidebar row (e.g. over
      // the editor or empty space) so a stale target is never shown.
      window.addEventListener(
        'dragover',
        (e) => {
          if (dragKind !== 'list') return
          let target = e.target as HTMLElement | null
          if (!target?.closest?.('[data-list-id]')) clearSidebarHighlight()
        },
        { capture: true, signal: ac.signal },
      )
      for (let row of Array.from(document.querySelectorAll<HTMLElement>('[data-list-id]'))) {
        row.addEventListener('dragover', (e) => handleListDragOver(e as DragEvent, row), {
          signal: ac.signal,
        })
        row.addEventListener('drop', (e) => handleListDrop(e as DragEvent, row), {
          signal: ac.signal,
        })
      }
      listDragCleanup = () => ac.abort()
    }

    let handleListDragStart = (e: DragEvent, row: HTMLElement) => {
      let target = e.target as HTMLElement
      if (target.closest('button, input, textarea, [contenteditable]')) {
        e.preventDefault()
        return
      }
      let sourceId = Number(row.dataset.listId)
      if (!Number.isFinite(sourceId)) return
      dragKind = 'list'
      draggedListId = sourceId
      dragIndex = null
      dropIndex = null
      clearDragOver()
      clearSidebarHighlight()
      // Synthetic drag events in some browsers (Firefox) carry a null
      // dataTransfer; the wiring must proceed regardless.
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'copy'
        e.dataTransfer.setData('text/x-list-id', String(sourceId))
        e.dataTransfer.setData('text/plain', `list:${sourceId}`)
      }
      startListDragWiring()
    }

    let handleListDrop = async (e: DragEvent, row: HTMLElement) => {
      e.preventDefault()
      e.stopPropagation()
      if (dragKind !== 'list' || draggedListId === null) return
      let sourceId = draggedListId
      let targetId = Number(row.dataset.listId)
      let sourceRow = document.querySelector<HTMLElement>(`[data-list-id="${sourceId}"]`)
      let sourceName =
        sourceRow?.querySelector('[data-list-name]')?.textContent?.trim() || `Liste #${sourceId}`
      let targetName =
        row.querySelector('[data-list-name]')?.textContent?.trim() || `Liste #${targetId}`
      let sourceUpdatedAt = Number(sourceRow?.dataset.updatedAt)
      let count = parseListCount(sourceRow)
      cleanupListDrag()
      if (!Number.isFinite(targetId) || targetId === sourceId) {
        handle.update()
        return
      }

      let message =
        count !== null
          ? `Alle ${count} Einträge von "${sourceName}" in "${targetName}" kopieren?`
          : `Alle Einträge von "${sourceName}" in "${targetName}" kopieren?`
      if (typeof window !== 'undefined' && !window.confirm(message)) {
        handle.update()
        return
      }

      // Flush pending edits when the loaded list is either side of the merge,
      // otherwise the frame reload would discard them.
      if (loadedListId !== null && (loadedListId === sourceId || loadedListId === targetId)) {
        let flushed = await flushNow()
        if (!flushed) {
          handle.update()
          return
        }
      }

      // Resolve the precondition *after* the flush: saving the open list bumps
      // its `updated_at`, so the sidebar snapshot taken before the flush would
      // fail the server's If-Match with a spurious 409. The loaded list's live
      // timestamp is authoritative; every other row keeps its server snapshot.
      let sourcePrecondition =
        loadedListId === sourceId && loadedUpdatedAt !== null ? loadedUpdatedAt : sourceUpdatedAt

      let headers = getCsrfHeaders()
      if (Number.isFinite(sourcePrecondition)) headers['If-Match'] = String(sourcePrecondition)
      else delete headers['If-Match']

      try {
        let response = await fetch(`/lists/${sourceId}/merge`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ targetId }),
        })
        if (response.ok) {
          handle.frame.reload().catch(() => {})
        } else if (response.status === 409) {
          let server = await response.json()
          if (server.id === loadedListId) {
            // The open list is the one that moved on, so the conflict banner's
            // actions (reload / overwrite) target the right row.
            conflictState = {
              show: true,
              serverState: {
                id: server.id,
                title: server.title,
                description: server.description,
                items: server.items,
                updated_at: server.updated_at,
              },
            }
          } else {
            // A *different* list's source row changed since this page rendered.
            // The conflict banner hydrates and saves the loaded list, so using
            // it here would silently switch the editor to another list. Refresh
            // the stale sidebar snapshot and ask the user to drag again.
            if (sourceRow && Number.isFinite(server.updated_at)) {
              sourceRow.setAttribute('data-updated-at', String(server.updated_at))
            }
            loadError = `Die Liste "${sourceName}" wurde zwischenzeitlich geändert. Bitte erneut ziehen.`
          }
          handle.update()
        } else if (response.status === 404) {
          loadError = 'Liste nicht gefunden'
          handle.update()
        } else if (response.status === 400) {
          loadError = count === 0 ? 'Die Quellliste ist leer' : 'Zusammenführen nicht möglich'
          handle.update()
        } else {
          loadError = 'Zusammenführen fehlgeschlagen'
          handle.update()
        }
      } catch {
        loadError = 'Zusammenführen fehlgeschlagen (Netzwerkfehler)'
        handle.update()
      }
    }

    let handleListDragEnd = () => {
      if (dragKind !== 'list') return
      cleanupListDrag()
      handle.update()
    }

    // Delegated listener: catches dragstart on any sidebar row regardless of
    // when the rows enter the DOM (the frame content is spliced in after this
    // client entry mounts). The event bubbles from the row to the document.
    let onDocumentDragStart = (e: DragEvent) => {
      if (dragKind === 'list') return
      let target = e.target as HTMLElement | null
      let row = target?.closest?.('[data-list-id]') as HTMLElement | null
      if (!row) return
      handleListDragStart(e, row)
    }

    let onDocumentDragEnd = () => {
      if (dragKind !== 'list') return
      cleanupListDrag()
      handle.update()
    }

    let handleDragEnd = () => {
      let dirty = draggedEl !== null || indicatorEl !== null || dragIndex !== null
      clearDragOver()
      clearSidebarHighlight()
      stopSidebarDragWiring()
      dragIndex = null
      dropIndex = null
      dragKind = null
      if (dirty) handle.update()
    }

    // Register the delegated list-drag listeners synchronously in the factory
    // body (after every handler is defined). The body runs once per mount —
    // only the render function re-runs on handle.update() — so this lands on the
    // client before the first render and before any drag; the `document` guard
    // keeps SSR a no-op. Delegation means rows may appear later (frame content).
    if (typeof document !== 'undefined') {
      document.addEventListener('dragstart', onDocumentDragStart, { signal: handle.signal })
      document.addEventListener('dragend', onDocumentDragEnd, { signal: handle.signal })
    }

    let clearAll = () => {
      if (!clearArmed) {
        clearArmed = true
        if (clearArmTimer) clearTimeout(clearArmTimer)
        clearArmTimer = setTimeout(() => disarmClear(), 4000)
        handle.update()
        return
      }
      disarmClear()
      showUndo(
        'clear',
        items.map((item) => ({ ...item })),
      )
      items = []
      setDirty()
      handle.update()
    }

    // "Nur Erledigte löschen": remove every completed item in one action, with
    // the same undo banner as the other deletions. It is only enabled while at
    // least one item is completed.
    let clearDone = () => {
      disarmClear()
      let doneItems = items.filter((item) => item.done === true)
      if (doneItems.length === 0) return
      showUndo(
        'clearDone',
        items.map((item) => ({ ...item })),
      )
      items = items.filter((item) => item.done !== true)
      setDirty()
      announce('Erledigte Elemente gelöscht')
      handle.update()
    }

    // One-shot sort control. Choosing an order reorders the real `items` array
    // (so it autosaves) and offers undo, exactly like Umkehren/Mischen. "manual"
    // is the neutral drag state and does nothing.
    let applySort = (mode: SortMode) => {
      disarmClear()
      if (mode === 'manual') return
      showUndo(
        'reorder',
        items.map((item) => ({ ...item })),
      )
      let newItems = [...items]
      switch (mode) {
        case 'az':
          newItems.sort((a, b) => a.label.localeCompare(b.label, 'de'))
          announce('A–Z sortiert')
          break
        case 'done':
          newItems.sort((a, b) => (a.done === true ? 1 : 0) - (b.done === true ? 1 : 0))
          announce('Nach Erledigt sortiert')
          break
        case 'updated':
          newItems.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
          announce('Nach Änderung sortiert')
          break
      }
      items = newItems
      setDirty()
      handle.update()
    }

    // Duplicate the currently open list by submitting the hidden copy form. The
    // frame runtime intercepts the POST (data-rmx-target) and follows the
    // server redirect straight to the new list's load URL, refreshing both the
    // editor and the sidebar. Any unsaved edits are flushed first so the copy
    // reflects what the user is currently looking at (otherwise the server would
    // copy the last persisted version).
    let copyCurrentList = async () => {
      if (loadedListId === null) return
      // Abort if there is an unresolved conflict the user must resolve first.
      let flushed = await flushNow()
      if (!flushed) return
      let token =
        typeof document !== 'undefined'
          ? document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
          : undefined
      if (token && copyCsrfRef) copyCsrfRef.value = token
      copyFormRef?.requestSubmit()
    }

    let addItem = () => {
      disarmClear()
      if (!newItemLabel.trim()) return
      // Use crypto.randomUUID() for stable client-side id
      let newItem: ListItem = {
        id: crypto.randomUUID(),
        label: newItemLabel.trim(),
        updatedAt: Date.now(),
      }
      items = [...items, newItem]
      newItemLabel = ''
      if (newItemRef) newItemRef.value = ''
      setDirty()
      handle.update()
      setTimeout(scrollToBottom, 0)
      scheduleAutosave(true)
    }

    let deleteItem = (index: number) => {
      disarmClear()
      if (!items[index]) return
      showUndo(
        'delete',
        items.map((item) => ({ ...item })),
      )
      // Simply filter — no id rewriting
      items = items.filter((_, i) => i !== index)
      setDirty()
      handle.update()
    }

    let toggleDone = (index: number) => {
      disarmClear()
      items = items.map((item, i) =>
        i === index ? { ...item, done: !(item.done === true), updatedAt: Date.now() } : item,
      )
      setDirty()
      handle.update()
      scheduleAutosave(true)
    }

    let moveItem = (from: number, to: number) => {
      disarmClear()
      if (from < 0 || from >= items.length) return
      if (to < 0 || to >= items.length) return
      if (from === to) return
      let newItems = moveItemInArray(items, from, to)
      if (newItems === items) return
      items = newItems
      setDirty()
      handle.update()
      scheduleAutosave(true)
    }

    let moveUp = (index: number) => moveItem(index, index - 1)
    let moveDown = (index: number) => moveItem(index, index + 1)

    let reverse = () => {
      disarmClear()
      showUndo(
        'reorder',
        items.map((item) => ({ ...item })),
      )
      items = [...items].reverse()
      setDirty()
      announce('Reihenfolge umgekehrt')
      handle.update()
    }

    let shuffle = () => {
      disarmClear()
      showUndo(
        'reorder',
        items.map((item) => ({ ...item })),
      )
      let newItems = [...items]
      for (let i = newItems.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1))
        ;[newItems[i], newItems[j]] = [newItems[j]!, newItems[i]!]
      }
      items = newItems
      setDirty()
      announce('Reihenfolge gemischt')
      handle.update()
    }

    let startEditing = (index: number) => {
      editingIndex = index
      let item = items[index]!
      editText = item.label
      editPriority = item.priority ?? ''
      editDue = item.due ?? ''
      editTags = (item.tags ?? []).join(', ')
      handle.update()
    }

    let saveEdit = () => {
      if (editingIndex !== null && editText.trim()) {
        items = items.map((item, i) => {
          if (i !== editingIndex) return item
          let next: ListItem = { ...item, label: editText.trim(), updatedAt: Date.now() }
          if (editPriority) next.priority = editPriority
          else delete next.priority
          if (editDue.trim()) next.due = editDue.trim()
          else delete next.due
          // Dedupe tags so a repeated value can't produce duplicate keys later.
          let tags = [
            ...new Set(
              editTags
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean),
            ),
          ]
          if (tags.length > 0) next.tags = tags
          else delete next.tags
          return next
        })
        setDirty()
      }
      editingIndex = null
      editText = ''
      editPriority = ''
      editDue = ''
      editTags = ''
      handle.update()
    }

    let cancelEdit = () => {
      editingIndex = null
      editText = ''
      editPriority = ''
      editDue = ''
      editTags = ''
      handle.update()
    }

    // Conflict resolution handlers
    let reloadFromServer = () => {
      if (conflictState.serverState) {
        hydrateFromInitialState(conflictState.serverState)
      }
      conflictState = { show: false, serverState: null }
      handle.update()
    }

    let forceOverwrite = () => {
      if (conflictState.serverState) {
        loadedUpdatedAt = conflictState.serverState.updated_at
      }
      conflictState = { show: false, serverState: null }
      handle.update()
      // Re-trigger save immediately
      setTimeout(() => saveNow(), 0)
    }

    // Best-effort keepalive flush of any pending edit to the currently loaded
    // list. The update route is PUT, which navigator.sendBeacon cannot send (it
    // is always POST), so use fetch with keepalive: true instead. keepalive lets
    // custom headers ride along (CSRF + If-Match), so we no longer need the
    // query-param CSRF or the _if_match body fallback.
    //
    // Shared by `beforeunload` (full page unload) and the frame's `reloadStart`
    // (list switch / search / pagination), which would otherwise discard edits
    // that are still inside the autosave debounce window.
    function flushWithKeepalive() {
      if (autosaveTimer) {
        clearTimeout(autosaveTimer)
        autosaveTimer = null
      }
      if (!isDirty()) return
      if (loadedListId === null) return
      let partial: Record<string, unknown> = {}
      if (title !== cleanTitle) partial.title = title
      if (description !== cleanDescription) partial.description = description
      if (JSON.stringify(items) !== cleanItemsJSON) partial.items = items
      if (Object.keys(partial).length === 0) return
      try {
        void fetch(`/lists/${loadedListId}`, {
          method: 'PUT',
          keepalive: true,
          headers: getCsrfHeaders(),
          body: JSON.stringify(partial),
        }).catch(() => {})
      } catch {
        // Best-effort flush — ignore any failure surfacing during unload.
      }
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', flushWithKeepalive, { signal: handle.signal })
    }

    // Status pill display
    let statusLabel = (): string => {
      switch (saveStatus) {
        case 'saved':
          return 'Gespeichert'
        case 'saving':
          return 'Speichern…'
        case 'dirty':
          return 'Ungespeichert'
        case 'error':
          return 'Fehler'
      }
    }

    let statusColor = (): string => {
      switch (saveStatus) {
        case 'saved':
          return theme.colors.text.muted
        case 'saving':
          return theme.colors.text.secondary
        case 'dirty':
          return '#d69e2e'
        case 'error':
          return theme.colors.action.danger.background
      }
    }

    // Keyboard navigation helpers
    let announce = (msg: string) => {
      if (liveRegion) liveRegion.textContent = msg
    }

    let focusItem = (id: string) => {
      setTimeout(() => {
        let el = listRef?.querySelector<HTMLElement>(`[data-item-id="${id}"]`)
        if (el) el.focus()
      }, 0)
    }

    let moveFocus = (targetIndex: number) => {
      let vis = visibleItems()
      if (targetIndex < 0 || targetIndex >= vis.length) return
      focusedId = vis[targetIndex]!.id
      handle.update()
      focusItem(vis[targetIndex]!.id)
    }

    // The active roving-tabindex id. Falls back to the first item when no item
    // is focused, or when `focusedId` references a row that no longer exists
    // (deleted / cleared / reloaded) — otherwise the whole list would end up
    // with tabindex="-1" and become unreachable by keyboard. While a filter is
    // active the fallback is the first *visible* item, so a filtered view still
    // has a tabbable row.
    let activeItemId = (): string | null =>
      focusedId && items.some((i) => i.id === focusedId)
        ? focusedId
        : (visibleItems()[0]?.id ?? null)

    let grabbedMove = (from: number, to: number) => {
      if (to < 0 || to >= items.length) return
      moveItem(from, to)
      grabbedId = items[to]!.id
      focusedId = items[to]!.id
      announce(`Position ${to + 1} von ${items.length}`)
      focusItem(items[to]!.id)
    }

    let handleRowKeyDown = (e: KeyboardEvent, index: number) => {
      // Only handle keydowns that originate on the row itself. Bubbled events
      // from nested controls (checkbox, edit textarea, action buttons) must
      // keep their own semantics.
      if (e.target !== e.currentTarget) return

      // While filtering, reordering is view-only: arrow keys / Home / End /
      // typeahead only move focus among the visible subset, and grab-reorder /
      // Ctrl+Cmd+Arrow quick-move are skipped so the item's real position never
      // changes under a filter.
      if (filterActive()) {
        let vis = visibleItems()
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault()
            moveFocus(index + 1)
            return
          case 'ArrowUp':
            e.preventDefault()
            moveFocus(index - 1)
            return
          case 'Home':
            e.preventDefault()
            moveFocus(0)
            return
          case 'End':
            e.preventDefault()
            moveFocus(vis.length - 1)
            return
          default:
            if (e.key.length === 1 && !e.altKey && !e.ctrlKey && !e.metaKey) {
              let target = findTypeaheadTarget(vis, index, e.key)
              if (target !== -1) {
                e.preventDefault()
                moveFocus(target)
              }
            }
            return
        }
      }

      let id = items[index]!.id

      // Quick-move: Ctrl/Cmd + Arrow moves the focused item directly
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          moveItem(index, index - 1)
          let target = items[index - 1] ? items[index - 1]!.id : id
          focusedId = target
          focusItem(target)
          return
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          moveItem(index, index + 1)
          let target = items[index + 1] ? items[index + 1]!.id : id
          focusedId = target
          focusItem(target)
          return
        }
      }

      if (grabbedId === null) {
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault()
            moveFocus(index + 1)
            return
          case 'ArrowUp':
            e.preventDefault()
            moveFocus(index - 1)
            return
          case 'Home':
            e.preventDefault()
            moveFocus(0)
            return
          case 'End':
            e.preventDefault()
            moveFocus(items.length - 1)
            return
          case 'Enter':
          case ' ':
            e.preventDefault()
            grabbedId = id
            announce(`Element aufgenommen, Position ${index + 1} von ${items.length}`)
            handle.update()
            return
          default:
            if (e.key.length === 1 && !e.altKey && !e.ctrlKey && !e.metaKey) {
              let target = findTypeaheadTarget(items, index, e.key)
              if (target !== -1) {
                e.preventDefault()
                moveFocus(target)
              }
            }
            return
        }
      }

      // Grabbed state
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          grabbedMove(index, index + 1)
          return
        case 'ArrowUp':
          e.preventDefault()
          grabbedMove(index, index - 1)
          return
        case 'Enter':
        case ' ':
          e.preventDefault()
          grabbedId = null
          announce(`Abgelegt an Position ${index + 1} von ${items.length}`)
          handle.update()
          return
        case 'Escape':
          e.preventDefault()
          grabbedId = null
          announce('Verschieben abgebrochen')
          handle.update()
          return
      }
    }

    return () => {
      // Show loading state
      if (loadingList) {
        return (
          <div
            mix={css({
              fontFamily: theme.fontFamily.sans,
              maxWidth: 'min(1000px, calc(100% - 2rem))',
              width: '100%',
              margin: '0 auto',
              padding: theme.space.xxl,
              textAlign: 'center',
              color: theme.colors.text.secondary,
              fontSize: theme.fontSize.lg,
            })}
          >
            Liste wird geladen…
          </div>
        )
      }

      // Show error state
      if (loadError) {
        return (
          <div
            mix={css({
              fontFamily: theme.fontFamily.sans,
              maxWidth: 'min(1000px, calc(100% - 2rem))',
              width: '100%',
              margin: '0 auto',
              padding: theme.space.xxl,
              textAlign: 'center',
              color: theme.colors.action.danger.background,
              fontSize: theme.fontSize.lg,
            })}
          >
            {loadError}
          </div>
        )
      }

      let vis = visibleItems()
      let doneCount = vis.filter((item) => item.done === true).length
      let totalCount = vis.length

      return (
        <div mix={cardStyle}>
          {/* Card header: editable title + primary action + save status */}
          <div mix={cardHeaderStyle}>
            <div mix={cardTitleWrapStyle}>
              <span mix={listContextStyle} data-list-context>
                {loadedListId === null ? 'Neue Liste' : `Liste #${loadedListId}`}
              </span>
              <h1 mix={titleHeadingStyle}>
                <label mix={visuallyHiddenStyle} htmlFor="lists-title">
                  Titel der Liste
                </label>
                <input
                  id="lists-title"
                  mix={[
                    titleInputStyle,
                    ref((el: HTMLInputElement) => {
                      titleInputRef = el
                    }),
                    on('input', (e) => {
                      title = e.currentTarget.value
                      setDirty()
                      handle.update()
                    }),
                    on('blur', () => {
                      scheduleAutosave(true)
                    }),
                  ]}
                  type="text"
                  placeholder={
                    loadedListId === null ? 'Kurzer Titel für diese Liste…' : 'Titel der Liste…'
                  }
                  maxLength={200}
                  defaultValue={title}
                />
              </h1>
            </div>
            <div mix={cardHeaderActionsStyle}>
              {loadedListId === null ? (
                <button
                  mix={[
                    button({ tone: 'primary' }),
                    on('click', () => {
                      void saveNow(true)
                    }),
                  ]}
                  disabled={saving}
                >
                  + Liste hinzufügen
                </button>
              ) : (
                <>
                  <button
                    mix={[
                      button({ tone: 'secondary' }),
                      on('click', () => {
                        void copyCurrentList()
                      }),
                    ]}
                    disabled={saving}
                    title="Diese Liste duplizieren"
                  >
                    ⧉ Duplizieren
                  </button>
                  {isDirty() && (
                    <button
                      mix={[button({ tone: 'secondary' }), on('click', discardChanges)]}
                      disabled={saving}
                      title="Ungespeicherte Änderungen verwerfen"
                    >
                      ↶ Verwerfen
                    </button>
                  )}
                  <button
                    mix={[
                      button({ tone: 'primary' }),
                      on('click', () => {
                        void flushNow()
                      }),
                    ]}
                    disabled={!isDirty() || saving}
                  >
                    Speichern
                  </button>
                  {/* Hidden form used by Duplizieren — the frame runtime
                      intercepts the POST (data-rmx-target) and follows the
                      server redirect to the new list. */}
                  <form
                    method="POST"
                    action={`/lists/${loadedListId}/copy`}
                    data-rmx-target={frames.listsContent}
                    hidden
                    mix={[
                      ref((el) => {
                        copyFormRef = el
                      }),
                    ]}
                  >
                    <input
                      type="hidden"
                      name="_csrf"
                      value=""
                      mix={[
                        ref((el) => {
                          copyCsrfRef = el
                        }),
                      ]}
                    />
                  </form>
                </>
              )}
              <span
                role="status"
                aria-live="polite"
                title="Speicherstatus dieser Liste"
                mix={css({
                  fontSize: theme.fontSize.xs,
                  fontWeight: theme.fontWeight.semibold,
                  color: statusColor(),
                  padding: `${theme.space.xs} ${theme.space.sm}`,
                  borderRadius: theme.radius.full,
                  backgroundColor: theme.surface.lvl3,
                })}
              >
                {statusLabel()}
              </span>
            </div>
          </div>

          <div mix={cardBodyStyle}>
            {/* Conflict banner */}
            {conflictState.show && (
              <div
                mix={css({
                  marginBottom: theme.space.md,
                  padding: theme.space.md,
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.colors.action.danger.background + '15',
                  border: `1px solid ${theme.colors.action.danger.border}`,
                  fontSize: theme.fontSize.sm,
                  display: 'flex',
                  gap: theme.space.sm,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                })}
              >
                <span mix={css({ flex: 1 })}>Die Liste wurde in einem anderen Tab geändert.</span>
                <button
                  mix={[
                    button({ tone: 'secondary' }),
                    css({ fontSize: theme.fontSize.xs }),
                    on('click', reloadFromServer),
                  ]}
                >
                  Neu laden
                </button>
                <button
                  mix={[
                    button({ tone: 'danger' }),
                    css({ fontSize: theme.fontSize.xs }),
                    on('click', forceOverwrite),
                  ]}
                >
                  Trotzdem speichern
                </button>
              </div>
            )}

            {/* Restored unsaved draft for a brand-new list */}
            {draftRestored && loadedListId === null && (
              <div
                mix={css({
                  marginBottom: theme.space.md,
                  padding: theme.space.md,
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.surface.lvl2,
                  border: `1px solid ${theme.colors.border.default}`,
                  fontSize: theme.fontSize.sm,
                  display: 'flex',
                  gap: theme.space.sm,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                })}
              >
                <span mix={css({ flex: 1 })}>
                  Ein ungespeicherter Entwurf wurde wiederhergestellt.
                </span>
                <button
                  mix={[
                    button({ tone: 'secondary' }),
                    css({ fontSize: theme.fontSize.xs }),
                    on('click', discardDraft),
                  ]}
                >
                  Entwurf verwerfen
                </button>
              </div>
            )}

            {/* Undo chip */}
            {undoSnapshot !== null && (
              <div
                mix={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: theme.space.md,
                  marginBottom: theme.space.md,
                  padding: `${theme.space.sm} ${theme.space.md}`,
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.surface.lvl2,
                  border: `1px solid ${theme.colors.border.default}`,
                  fontSize: theme.fontSize.sm,
                })}
              >
                <span mix={css({ flex: 1 })}>
                  {undoKind === 'clear'
                    ? 'Alle Elemente gelöscht.'
                    : undoKind === 'clearDone'
                      ? 'Erledigte Elemente gelöscht.'
                      : undoKind === 'reorder'
                        ? 'Reihenfolge geändert.'
                        : 'Element gelöscht.'}
                </span>
                <button
                  mix={[
                    button({ tone: 'secondary' }),
                    css({ fontSize: theme.fontSize.xs }),
                    on('click', undo),
                  ]}
                >
                  ↶ Rückgängig
                </button>
              </div>
            )}

            {/* New-list helper hint */}
            {loadedListId === null && (
              <p
                mix={css({
                  marginBottom: theme.space.md,
                  fontSize: theme.fontSize.xs,
                  color: theme.colors.text.muted,
                })}
              >
                {!title.trim() && !description.trim()
                  ? 'Gib deiner Liste einen Titel oder eine Beschreibung.'
                  : 'Bereit — klicke auf „+ Liste hinzufügen“, um die Liste zu speichern.'}
              </p>
            )}

            {/* Description — collapsed unless the list has one (or the user opens it) */}
            <div mix={css({ marginBottom: theme.space.md })}>
              {showDescription() ? (
                <>
                  <div mix={descriptionHeadStyle}>
                    <label mix={descriptionLabelStyle} htmlFor="lists-description">
                      Beschreibung
                    </label>
                    <button
                      type="button"
                      mix={[
                        collapseBtnStyle,
                        on('click', () => {
                          descriptionMode = 'closed'
                          handle.update()
                        }),
                      ]}
                      aria-label="Beschreibung ausblenden"
                      title="Beschreibung ausblenden"
                    >
                      −
                    </button>
                  </div>
                  <textarea
                    id="lists-description"
                    mix={[
                      descriptionTextareaStyle,
                      on('input', (e) => {
                        description = e.currentTarget.value
                        setDirty()
                        handle.update()
                      }),
                      on('blur', () => {
                        scheduleAutosave(true)
                      }),
                      ref((el: HTMLTextAreaElement) => {
                        descriptionInputRef = el
                      }),
                    ]}
                    placeholder="Beschreibung für diese Liste eingeben…"
                    maxLength={500}
                    rows={2}
                    wrap="soft"
                  >
                    {description as never}
                  </textarea>
                </>
              ) : (
                <button
                  type="button"
                  mix={[
                    showDescriptionBtnStyle,
                    on('click', () => {
                      descriptionMode = 'open'
                      handle.update()
                    }),
                  ]}
                >
                  + Beschreibung hinzufügen
                </button>
              )}
            </div>

            {/* Add item — one-line field; Enter adds, Shift+Enter inserts a newline */}
            <div
              mix={css({
                display: 'flex',
                gap: theme.space.sm,
                marginBottom: theme.space.md,
                alignItems: 'center',
              })}
            >
              <textarea
                mix={[
                  css({
                    padding: `${theme.space.xs} ${theme.space.sm}`,
                    borderRadius: theme.radius.md,
                    border: `1px solid ${theme.colors.border.strong}`,
                    flex: 1,
                    fontSize: theme.fontSize.md,
                    outline: 'none',
                    fontFamily: theme.fontFamily.sans,
                    minHeight: '38px',
                    resize: 'vertical',
                    backgroundColor: theme.surface.lvl0,
                    color: theme.colors.text.primary,
                    '&:focus': {
                      borderColor: theme.colors.focus.ring,
                      boxShadow: `0 0 0 3px ${theme.colors.focus.ring}33`,
                    },
                  }),
                  on('input', (e) => {
                    newItemLabel = e.currentTarget.value
                    handle.update()
                  }),
                  on('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      addItem()
                    }
                  }),
                  ref((el) => {
                    newItemRef = el
                  }),
                ]}
                placeholder="Neues Element eingeben…"
                rows={1}
                wrap="soft"
              >
                {newItemLabel as never}
              </textarea>
              <button mix={[button({ tone: 'primary' }), on('click', addItem)]}>
                + Element hinzufügen
              </button>
            </div>

            {/* Screen-reader live region for reorder/undo announcements */}
            <div
              aria-live="polite"
              mix={[
                css({
                  position: 'absolute',
                  width: '1px',
                  height: '1px',
                  overflow: 'hidden',
                  clip: 'rect(0 0 0 0)',
                  whiteSpace: 'nowrap',
                }),
                ref((el: HTMLElement) => {
                  liveRegion = el
                }),
              ]}
            />

            {/* Items list */}
            <div
              mix={css({
                border: `1px solid ${theme.colors.border.default}`,
                borderRadius: theme.radius.xl,
                overflow: 'hidden',
                // Flex column so the element list below fills the remaining
                // height of the bounded card and scrolls internally. Without
                // this the wrapper stayed `overflow: hidden` block, clipping
                // the (now flex) list so the last items were unreachable even
                // when scrolled. Auto basis keeps the list part of the card's
                // natural height when it is short.
                display: 'flex',
                flexDirection: 'column',
                flexGrow: 1,
                flexShrink: 1,
                flexBasis: 'auto',
                minHeight: 0,
              })}
            >
              <div mix={panelHeaderStyle}>
                <div mix={panelLeftStyle}>
                  <h2 mix={visuallyHiddenStyle}>Elemente</h2>
                  {items.length > 0 && (
                    <>
                      <input
                        id="lists-inner-filter"
                        type="search"
                        placeholder="Elemente durchsuchen…"
                        maxLength={200}
                        aria-label="Elemente durchsuchen"
                        mix={[
                          filterInputStyle,
                          panelFilterInputStyle,
                          ref((el: HTMLInputElement) => {
                            filterInputRef = el
                          }),
                          on('input', (e) => {
                            listFilter = e.currentTarget.value
                            handle.update()
                          }),
                          on('keydown', (e) => {
                            if (e.key === 'Escape' && listFilter) {
                              e.preventDefault()
                              listFilter = ''
                              if (filterInputRef) filterInputRef.value = ''
                              handle.update()
                            }
                          }),
                        ]}
                        defaultValue={listFilter}
                      />
                      {listFilter.trim() && (
                        <button
                          type="button"
                          mix={[
                            clearFilterBtnStyle,
                            on('click', () => {
                              listFilter = ''
                              if (filterInputRef) filterInputRef.value = ''
                              handle.update()
                            }),
                          ]}
                          aria-label="Suche zurücksetzen"
                          title="Suche zurücksetzen"
                        >
                          ✕
                        </button>
                      )}
                    </>
                  )}
                </div>
                <div mix={panelRightStyle}>
                  <select
                    mix={[
                      sortSelectStyle,
                      on('change', (e) => {
                        applySort((e.currentTarget.value as SortMode) || 'manual')
                        e.currentTarget.value = 'manual'
                      }),
                    ]}
                    aria-label="Sortieren"
                    value="manual"
                  >
                    <option value="manual">Sortieren…</option>
                    <option value="az">A–Z</option>
                    <option value="done">Nach Erledigt</option>
                    <option value="updated">Nach Änderung</option>
                  </select>
                  <button
                    type="button"
                    mix={[iconToolbarBtnStyle, on('click', reverse)]}
                    title="Reihenfolge umkehren"
                    aria-label="Reihenfolge umkehren"
                  >
                    ↺
                  </button>
                  <button
                    type="button"
                    mix={[iconToolbarBtnStyle, on('click', shuffle)]}
                    title="Reihenfolge mischen"
                    aria-label="Reihenfolge mischen"
                  >
                    ⇄
                  </button>
                  <button
                    type="button"
                    mix={[
                      iconToolbarBtnStyle,
                      on('click', () =>
                        announce(
                          'Tastatur: Enter nimmt ein Element auf, Pfeile verschieben es, Enter legt es ab. Strg+Pfeile verschieben direkt.',
                        ),
                      ),
                    ]}
                    title="Tastatur: Enter aufnehmen, Pfeile verschieben, Enter ablegen. Strg+Pfeile für Direktverschieben."
                    aria-label="Tastatur-Hinweise"
                  >
                    ?
                  </button>
                  {totalCount > 0 && (
                    <div
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={totalCount}
                      aria-valuenow={doneCount}
                      aria-label={`${doneCount} von ${totalCount} erledigt`}
                      mix={css({
                        width: '60px',
                        height: '6px',
                        borderRadius: theme.radius.full,
                        backgroundColor: theme.surface.lvl0,
                        overflow: 'hidden',
                      })}
                    >
                      <div
                        mix={css({
                          height: '100%',
                          width: `${(doneCount / totalCount) * 100}%`,
                          backgroundColor: theme.colors.success.background,
                          borderRadius: theme.radius.full,
                          transition: 'width 0.2s ease',
                        })}
                      />
                    </div>
                  )}
                  <span mix={countTextStyle}>
                    {totalCount > 0
                      ? `${doneCount} von ${totalCount} erledigt`
                      : `${totalCount} Einträge`}
                  </span>
                  <details mix={menuDetailsStyle}>
                    <summary
                      mix={menuSummaryStyle}
                      aria-label="Weitere Aktionen"
                      title="Weitere Aktionen"
                    >
                      ⋯
                    </summary>
                    <div mix={menuPanelStyle}>
                      <button
                        mix={[button({ tone: 'secondary' }), on('click', clearDone)]}
                        disabled={items.filter((item) => item.done === true).length === 0}
                        title="Alle erledigten Elemente aus der Liste entfernen"
                      >
                        ✔ Nur Erledigte löschen
                      </button>
                      <button
                        mix={[
                          button({ tone: 'secondary' }),
                          dangerTextStyle,
                          ...(clearArmed ? [dangerArmedStyle] : []),
                          on('click', clearAll),
                        ]}
                        disabled={items.length === 0}
                        title="Alle Elemente dieser Liste löschen"
                      >
                        {clearArmed ? 'Wirklich alle löschen?' : '✕ Alle löschen'}
                      </button>
                    </div>
                  </details>
                </div>
              </div>

              {items.length === 0 ? (
                <div
                  mix={css({
                    padding: `${theme.space.xxl} ${theme.space.lg}`,
                    textAlign: 'center',
                    color: theme.colors.text.muted,
                  })}
                >
                  Noch keine Elemente. Füge oben eines hinzu.
                </div>
              ) : totalCount === 0 ? (
                <div
                  mix={css({
                    padding: `${theme.space.xxl} ${theme.space.lg}`,
                    textAlign: 'center',
                    color: theme.colors.text.muted,
                  })}
                >
                  Keine Treffer für „{listFilter.trim()}“.
                </div>
              ) : (
                <div
                  role="list"
                  mix={[
                    css({
                      // Fill the card's remaining height and scroll internally
                      // so the element list is always a bounded, scrollable
                      // region inside the viewport — with any number of items.
                      // (A fixed 320px cap grew the card past the viewport,
                      // pushing later elements below the fold.) Auto basis keeps
                      // items part of the card's natural height when short.
                      flexGrow: 1,
                      flexShrink: 1,
                      flexBasis: 'auto',
                      minHeight: 0,
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      // Use the standardized scrollbar properties (Chrome/Edge
                      // 121+, Firefox, Safari 18.2+) instead of the non-standard
                      // ::-webkit-scrollbar pseudo-elements, which Firefox
                      // ignores — that was leaving the element list without a
                      // scrollbar when it overflowed.
                      scrollbarWidth: 'thin',
                      scrollbarColor: `${theme.colors.border.strong} ${theme.surface.lvl2}`,
                    }),
                    ref((el) => {
                      listRef = el
                    }),
                    ref((el) => {
                      let ac = new AbortController()
                      el.addEventListener(
                        'dragover',
                        (e) => handleContainerDragOver(e as DragEvent),
                        { signal: ac.signal },
                      )
                      // Capture-phase so it fires even while over a row (rows
                      // stop the bubble-phase dragover), enabling edge auto-scroll.
                      el.addEventListener(
                        'dragover',
                        (e) => autoScrollList((e as DragEvent).clientY),
                        { capture: true, signal: ac.signal },
                      )
                      el.addEventListener('drop', (e) => handleDrop(e as DragEvent), {
                        signal: ac.signal,
                      })

                      // Reveal/hide a row's action cluster on hover or focus.
                      // Delegated on the container so it survives re-renders.
                      function setRowActions(row: HTMLElement, op: string) {
                        let cluster = row.querySelector<HTMLElement>('[data-item-actions]')
                        if (cluster) {
                          cluster.style.opacity = op
                          cluster.style.pointerEvents = op === '1' ? 'auto' : 'none'
                        }
                      }
                      let activeRow: HTMLElement | null = null
                      function revealRow(row: HTMLElement) {
                        if (activeRow && activeRow !== row) setRowActions(activeRow, '')
                        setRowActions(row, '1')
                        activeRow = row
                      }
                      function hideRowActions() {
                        if (activeRow) {
                          setRowActions(activeRow, '')
                          activeRow = null
                        }
                      }
                      el.addEventListener(
                        'mouseover',
                        (e) => {
                          let row = (e.target as HTMLElement).closest<HTMLElement>(
                            '[role="listitem"]',
                          )
                          if (row) revealRow(row)
                        },
                        { signal: ac.signal },
                      )
                      el.addEventListener('mouseleave', hideRowActions, { signal: ac.signal })
                      el.addEventListener(
                        'focusin',
                        (e) => {
                          let row = (e.target as HTMLElement).closest<HTMLElement>(
                            '[role="listitem"]',
                          )
                          if (row) revealRow(row)
                        },
                        { signal: ac.signal },
                      )
                      el.addEventListener(
                        'focusout',
                        (e) => {
                          let row = (e.target as HTMLElement).closest<HTMLElement>(
                            '[role="listitem"]',
                          )
                          let related = e.relatedTarget as Node | null
                          if (row && (!related || !row.contains(related))) setRowActions(row, '')
                        },
                        { signal: ac.signal },
                      )

                      return () => ac.abort()
                    }),
                  ]}
                >
                  {vis.map((item, index) => {
                    let realIndex = items.findIndex((i) => i.id === item.id)
                    return (
                      <div
                        key={item.id}
                        mix={[
                          css({
                            position: 'relative',
                            display: 'flex',
                            gap: theme.space.md,
                            alignItems: 'center',
                            // Dense rows: the comfortable `md` padding cost 49px
                            // per row, so more of the card's height goes to rows
                            // instead of whitespace.
                            padding: `${theme.space.sm} ${theme.space.md}`,
                            // Keep a right gutter so the label doesn't run under the
                            // overlay action cluster; the cluster itself is absolute
                            // and takes no layout space.
                            paddingRight: '6.5rem',
                            borderBottom:
                              index < vis.length - 1
                                ? `1px solid ${theme.colors.border.subtle}`
                                : 'none',
                            backgroundColor:
                              index % 2 === 0 ? theme.surface.lvl0 : theme.surface.lvl1,
                            '&:focus-visible': {
                              outline: `2px solid ${theme.colors.focus.ring}`,
                              outlineOffset: '-2px',
                            },
                          }),
                          ...(item.id === grabbedId
                            ? [css({ boxShadow: `inset 0 0 0 2px ${theme.colors.focus.ring}` })]
                            : []),
                          ref((el) => {
                            let ac = new AbortController()
                            el.addEventListener(
                              'dragstart',
                              (e) => {
                                let idx = parseInt(
                                  (e.currentTarget as HTMLElement).dataset.index || '0',
                                  10,
                                )
                                handleDragStart(e as DragEvent, idx)
                              },
                              { signal: ac.signal },
                            )
                            el.addEventListener(
                              'dragover',
                              (e) => {
                                let idx = parseInt(
                                  (e.currentTarget as HTMLElement).dataset.index || '0',
                                  10,
                                )
                                handleDragOver(e as DragEvent, idx)
                              },
                              { signal: ac.signal },
                            )
                            el.addEventListener('drop', (e) => handleDrop(e as DragEvent), {
                              signal: ac.signal,
                            })
                            el.addEventListener('dragend', () => handleDragEnd(), {
                              signal: ac.signal,
                            })
                            return () => ac.abort()
                          }),
                          on('keydown', (e) => handleRowKeyDown(e, index)),
                          on('click', () => {
                            focusedId = item.id
                            handle.update()
                          }),
                        ]}
                        role="listitem"
                        draggable={!filterActive()}
                        data-index={realIndex}
                        data-item-id={item.id}
                        tabIndex={item.id === activeItemId() ? 0 : -1}
                      >
                        <span mix={gripStyle} data-grip="" aria-hidden="true">
                          ⠿
                        </span>
                        <input
                          type="checkbox"
                          checked={item.done === true}
                          aria-label={
                            item.done === true ? 'Als offen markieren' : 'Als erledigt markieren'
                          }
                          mix={[
                            css({
                              width: '18px',
                              height: '18px',
                              flexShrink: 0,
                              cursor: 'pointer',
                              accentColor: theme.colors.focus.ring,
                            }),
                            on('change', (e) => {
                              let idx = parseInt(
                                (e.currentTarget.closest('[data-index]') as HTMLElement | null)
                                  ?.dataset.index || '0',
                                10,
                              )
                              toggleDone(idx)
                            }),
                          ]}
                        />
                        {editingIndex === realIndex ? (
                          <div mix={itemMainStyle}>
                            <textarea
                              mix={[
                                editTextareaStyle,
                                on('input', (e) => {
                                  editText = e.currentTarget.value
                                  handle.update()
                                }),
                                on('keydown', (e) => {
                                  if (e.key === 'Escape') cancelEdit()
                                }),
                              ]}
                              autoFocus
                              rows={3}
                              wrap="soft"
                            >
                              {editText as never}
                            </textarea>
                            <div mix={metaEditorStyle}>
                              <select
                                mix={[
                                  metaFieldStyle,
                                  on('change', (e) => {
                                    editPriority = (e.currentTarget.value || '') as
                                      | ''
                                      | ItemPriority
                                  }),
                                ]}
                                aria-label="Priorität"
                                value={editPriority}
                              >
                                <option value="">Priorität…</option>
                                <option value="low">Niedrig</option>
                                <option value="medium">Mittel</option>
                                <option value="high">Hoch</option>
                              </select>
                              <input
                                type="date"
                                mix={[
                                  metaFieldStyle,
                                  on('change', (e) => {
                                    editDue = e.currentTarget.value
                                  }),
                                ]}
                                aria-label="Fällig am"
                                value={editDue}
                              />
                              <input
                                type="text"
                                mix={[
                                  metaFieldStyle,
                                  on('input', (e) => {
                                    editTags = e.currentTarget.value
                                  }),
                                ]}
                                placeholder="Tags, kommagetrennt"
                                aria-label="Tags"
                                value={editTags}
                              />
                            </div>
                          </div>
                        ) : (
                          <div mix={itemMainStyle}>
                            <span
                              mix={[
                                multilineDisplayStyle,
                                item.done === true &&
                                  css({
                                    textDecoration: 'line-through',
                                    color: theme.colors.text.muted,
                                  }),
                              ].filter(Boolean)}
                            >
                              {item.label}
                            </span>
                            {(item.priority != null ||
                              item.due != null ||
                              (item.tags != null && item.tags.length > 0)) && (
                              <div mix={metaRowStyle}>
                                {item.priority != null && (
                                  <span mix={[metaBadgeStyle, priorityBadge(item.priority)]}>
                                    {priorityLabel(item.priority)}
                                  </span>
                                )}
                                {item.due != null && (
                                  <span mix={[metaBadgeStyle, dueBadgeStyle]}>📅 {item.due}</span>
                                )}
                                {Array.from(new Set(item.tags ?? [])).map((tag) => (
                                  <span key={tag} mix={[metaBadgeStyle, tagChipStyle]}>
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        <div
                          draggable="false"
                          data-item-actions
                          mix={[
                            itemActionsStyle,
                            editingIndex === realIndex &&
                              css({ opacity: 1, pointerEvents: 'auto' }),
                          ].filter(Boolean)}
                        >
                          {editingIndex === realIndex ? (
                            <>
                              <button
                                mix={[iconActionStyle, iconActionFirstStyle, on('click', saveEdit)]}
                                title="Speichern"
                              >
                                <Glyph name="check" width={16} height={16} />
                              </button>
                              <button
                                mix={[
                                  iconActionStyle,
                                  iconActionLastStyle,
                                  on('click', cancelEdit),
                                ]}
                                title="Abbrechen"
                              >
                                <Glyph name="close" width={16} height={16} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                mix={[
                                  iconActionStyle,
                                  iconActionFirstStyle,
                                  on('click', () => startEditing(realIndex)),
                                ]}
                                title="Bearbeiten"
                              >
                                <Glyph name="edit" width={16} height={16} />
                              </button>
                              <button
                                mix={[
                                  iconActionStyle,
                                  iconActionDangerStyle,
                                  on('click', () => deleteItem(realIndex)),
                                ]}
                                title="Löschen"
                              >
                                <Glyph name="close" width={16} height={16} />
                              </button>
                              {!filterActive() && (
                                <>
                                  <button
                                    mix={[iconActionStyle, on('click', () => moveUp(realIndex))]}
                                    disabled={realIndex === 0}
                                    title="Nach oben"
                                  >
                                    ↑
                                  </button>
                                  <button
                                    mix={[
                                      iconActionStyle,
                                      iconActionLastStyle,
                                      on('click', () => moveDown(realIndex)),
                                    ]}
                                    disabled={realIndex === items.length - 1}
                                    title="Nach unten"
                                  >
                                    ↓
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )
    }
  },
)
