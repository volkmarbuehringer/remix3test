import { clientEntry, on, ref, type Handle } from 'remix/ui'
import { Glyph } from '../lib/glyph.ts'

import {
  previewMoveBlock,
  previewResizeBlockTime,
  type AppointmentLayoutBlock,
  type LayoutResult,
} from './schedule-layout.ts'
import { getTypeDragState, setTypeDragState, setPanelDropActive } from '../lib/appointtype-drag.ts'
import { interactionState } from './appointment-interaction-state.ts'
import { showToast } from './toast.ts'
import { clamp } from '../lib/math.ts'

import {
  HOURS,
  LABEL_WIDTH,
  DRAG_THRESHOLD,
  COLLISION_STATUS,
  SUB_SLOT_HEIGHT,
  SUB_SLOTS,
  SLOT_HEIGHT,
  type AppData,
  type DragState,
  type ResizeState,
  type GridMeasurement,
  type GestureKind,
} from './appointment-grid-types.ts'
import {
  handleMutationResponse,
  handleBatchMutationResponses,
  readData,
  computeVisibleDays,
  computeOfferingTimeRange,
  computeBookableSlots,
  copyAppt,
} from './appointment-grid-lib.ts'
import {
  gridWrapperStyle,
  headerRowStyle,
  cornerCellStyle,
  dayHeaderStyle,
  dayNameStyle,
  dayDateStyle,
  todayDayNameStyle,
  todayDayDateStyle,
  gridBodyStyle,
  timeColumnStyle,
  timeSlotRowStyle,
  timeLabelStyle,
  subTimeLabelStyle,
  dayColumnStyle,
  hourLineStyle,
  subHourLineStyle,
  blockBoxStyle,
  foreignBlockStyle,
  currentUserBlockStyle,
  draggingBlockStyle,
  blockTitleStyle,
  adminBlockInnerStyle,
  adminEmailStyle,
  hoveredBlockStyle,
  expandedTitleStyle,
  editingBlockStyle,
  hiddenStyle,
  inputStyle,
  draftBlockStyle,
  draftButtonsStyle,
  draftSaveButtonStyle,
  draftCancelButtonStyle,
  ghostBlockStyle,
  typeDragGhostStyle,
  resizeHandleStyle,
  activeResizeHandleStyle,
  startResizeHandleStyle,
  endResizeHandleStyle,
  trashcanZoneStyle,
  trashcanVisibleStyle,
  trashcanHoverStyle,
  nonOfferingSlotStyle,
  emptyStateWrapperStyle,
  emptyStateTextStyle,
  ssrPlaceholderWrapper,
} from './appointment-grid-styles.ts'

export const AppointmentGrid = clientEntry(
  import.meta.url + '#AppointmentGrid',
  function AppointmentGrid(handle: Handle) {
    let draftInput: HTMLTextAreaElement | null = null
    let renameInputs = new Map<number, HTMLTextAreaElement>()

    let draftState: {
      active: boolean
      dayIdx: number
      start: number
      end: number
    } = { active: false, dayIdx: 0, start: 0, end: 60 }

    let editingId: number | null = null
    let hoveredBlockId: number | null = null
    let lastClick = { time: 0, blockId: -1 }

    // Drag and resize state
    let preview: LayoutResult | null = null
    let dragState: DragState | null = null
    let resizeState: ResizeState | null = null
    let activeGesture: GestureKind | null = null

    // Sync interaction state for SSE subscriber
    function syncInteractionState() {
      interactionState.active = activeGesture !== null || editingId !== null || draftState.active
    }
    let gridBodyElement: HTMLElement | null = null
    let draggedBlockOffset = { x: 0, y: 0 }
    let isOverTrashcan = false
    let isOverTypesPanel = false
    let sidebarColElement: HTMLElement | null = null
    let sidebarElement: HTMLElement | null = null
    let trashcanElement: HTMLElement | null = null

    // Type-drag state (from appointtype panel drop)
    let typeDragPreview: { date: number; startMinute: number; dayIdx: number } | null = null

    // Route hrefs (updated from data each render)
    let apptHref = ''
    let apptTypesHref = ''

    // Current visible days (computed from offerings) — updated each render
    let currentVisibleDays: AppData['days'] = []
    let currentVisibleDayDates: number[] = []
    // Offering time range for positioning calculations — the grid rows start
    // at currentOfferingStartMin, so all absolute pixel positions must be
    // relative to this offset rather than absolute midnight.
    let currentOfferingStartMin = 0
    let currentOfferingEndMin = 1440

    // Always-active listeners for type-drag from types panel (client-side only)
    if (typeof document !== 'undefined') {
      document.addEventListener('pointermove', onTypeDragMove, { signal: handle.signal })
      document.addEventListener('pointerup', onTypeDragEnd, { signal: handle.signal })
      document.addEventListener('pointercancel', onTypeDragCancel, { signal: handle.signal })
    }

    return () => {
      // Client-only rendering — SSR has no DOM so readData() can't work.
      // During SSR, return a bare wrapper matching the client root tag to
      // avoid hydration mismatch. The real grid renders only on the client
      // after hydration reads the embedded JSON from the DOM.
      if (typeof document === 'undefined') {
        return <div mix={ssrPlaceholderWrapper}></div>
      }

      let data = readData()
      let days = data.days
      let offerings = data.offerings ?? []
      let csrfToken = data.csrfToken
      apptHref = data.appointmentHref ?? ''
      apptTypesHref = data.appointmentTypesHref ?? ''

      let todayMs = (() => {
        let t = new Date()
        return Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())
      })()

      // Compute visible days from offerings
      let visibleDays = computeVisibleDays(days, offerings)

      // Check if there are any bookable days
      let hasNoOfferings = visibleDays.length === 0 || offerings.length === 0

      // Compute the set of bookable minutes across all visible days.
      // Only rows with at least one bookable slot on any day are rendered.
      // Exclude the currently-dragged/resized block for self-exclusion.
      let excludeApptId = activeGesture === 'drag' ? dragState?.blockId : activeGesture === 'resize' ? resizeState?.blockId : undefined
      let bookableAppts = excludeApptId !== undefined ? data.appointments.filter((a) => a.id !== excludeApptId) : data.appointments
      let { allBookableMinutes, bookableByDay } = computeBookableSlots(offerings, visibleDays, bookableAppts)
      let offeringRange = computeOfferingTimeRange(offerings)

      // Store visible days and offering range for event handler access
      currentVisibleDays = visibleDays
      currentVisibleDayDates = visibleDays.map((d) => d.date)
      currentOfferingStartMin = offeringRange.startMin
      currentOfferingEndMin = offeringRange.endMin

      // Use preview blocks if available, otherwise original appointments
      let sourceBlocks: AppointmentLayoutBlock[] = preview?.blocks ?? data.appointments

      // Group appointments by visible day (O(n) via Map)
      let byDate = new Map<number, AppointmentLayoutBlock[]>()
      for (let appt of sourceBlocks) {
        let list = byDate.get(appt.date)
        if (!list) {
          list = []
          byDate.set(appt.date, list)
        }
        list.push(appt)
      }
      let groups = visibleDays.map((d) => byDate.get(d.date) ?? [])

      let isDragging = dragState?.active === true
      let isResizing = resizeState?.active === true

      // Empty state when no offerings exist
      if (hasNoOfferings) {
        return (
          <div mix={emptyStateWrapperStyle}>
            <p mix={emptyStateTextStyle}>No bookable slots this week.</p>
          </div>
        )
      }

      let numDays = visibleDays.length
      let gridTemplateCols = `${LABEL_WIDTH}px repeat(${numDays}, 1fr)`

      return (
        <div
          aria-label="Wöchentliche Terminübersicht"
          data-dragging={isDragging ? 'true' : undefined}
          data-resizing={isResizing ? 'true' : undefined}
          mix={gridWrapperStyle}
        >
          <div mix={headerRowStyle} style={`grid-template-columns: ${gridTemplateCols};`}>
            <div mix={cornerCellStyle}>
              {/* Trashcan — visible during drag */}
              <div
                aria-label="Termin löschen"
                mix={[
                  trashcanZoneStyle,
                  isDragging ? trashcanVisibleStyle : undefined,
                  isOverTrashcan ? trashcanHoverStyle : undefined,
                  ref((el) => {
                    if (el) trashcanElement = el
                  }),
                ]}
              >
                <Glyph name="trash" width={18} height={18} />
              </div>
            </div>
            {visibleDays.map((day, i) => {
              let isToday = day.date === todayMs
              return (
                <div key={i} mix={dayHeaderStyle}>
                  <span mix={isToday ? todayDayNameStyle : dayNameStyle}>{day.dayName}</span>
                  <span mix={isToday ? todayDayDateStyle : dayDateStyle}>{day.dateStr}</span>
                </div>
              )
            })}
          </div>

          <div
            mix={[
              gridBodyStyle,
              ref((el) => {
                if (el) gridBodyElement = el
              }),
            ]}
            style={`grid-template-columns: ${gridTemplateCols};`}
          >
            <div mix={timeColumnStyle}>
              {allBookableMinutes.map((minute: number) => {
                let isHour = minute % 60 === 0
                let isHalf = minute % 60 === 30
                return (
                  <div key={`t${minute}`} mix={timeSlotRowStyle}>
                    {isHour && minute > 0 ? (
                      <span mix={timeLabelStyle}>{minute / 60}:00</span>
                    ) : isHalf ? (
                      <span mix={subTimeLabelStyle}>:30</span>
                    ) : null}
                  </div>
                )
              })}
            </div>

            {visibleDays.map((day, dayIdx) => {
              let date = day.date
              return (
                <div
                  key={`day${date}`}
                  mix={dayColumnStyle}
                  style={`min-height: ${((offeringRange.endMin - offeringRange.startMin) / 60) * SLOT_HEIGHT}px;`}
                >
                  {allBookableMinutes.map((minute: number) => {
                    let isHour = minute % 60 === 0
                    let dayBookable = bookableByDay.get(date)
                    let bookable = dayBookable?.has(minute) ?? false
                    return (
                      <div
                        key={`m${minute}`}
                        mix={[
                          isHour ? hourLineStyle : subHourLineStyle,
                          bookable ? undefined : nonOfferingSlotStyle,
                          bookable ? on('click', () => startDraft(dayIdx, minute)) : undefined,
                        ]}
                      />
                    )
                  })}

                  {groups[dayIdx].map((appt) => {
                    let isEditing = editingId === appt.id
                    let isForeign = data.currentUserId > 0 && appt.user_id !== data.currentUserId
                    let isCurrentUser = data.currentUserId > 0 && appt.user_id === data.currentUserId
                    let isRestrictedBlock = isForeign && !data.isAdmin
                    // Position relative to offering start — grid rows begin at currentOfferingStartMin
                    let topPx = ((appt.start_min - currentOfferingStartMin) / 60) * SLOT_HEIGHT
                    let heightPx = Math.max(
                      isEditing ? 84 : ((appt.end_min - appt.start_min) / 60) * SLOT_HEIGHT,
                    )
                    let isBlockDragging = isDragging && dragState?.blockId === appt.id
                    let isBlockResizing = isResizing && resizeState?.blockId === appt.id
                    let isHovered =
                      hoveredBlockId === appt.id && !isDragging && !isResizing && !isRestrictedBlock

                    return (
                      <div
                        key={`a${appt.id}`}
                        data-appointment-block="true"
                        data-block-id={appt.id}
                        mix={[
                          blockBoxStyle,
                          isRestrictedBlock ? foreignBlockStyle : undefined,
                          isCurrentUser ? currentUserBlockStyle : undefined,
                          isBlockDragging ? draggingBlockStyle : undefined,
                          isHovered ? hoveredBlockStyle : undefined,
                          isEditing ? editingBlockStyle : undefined,
                          on('pointerdown', (e) => handleBlockPointerDown(appt, e)),
                          on('mouseenter', () => {
                            if (activeGesture) return
                            if (isRestrictedBlock) return
                            hoveredBlockId = appt.id
                            handle.update()
                          }),
                          on('mouseleave', () => {
                            if (isRestrictedBlock) return
                            hoveredBlockId = null
                            handle.update()
                          }),
                        ]}
                        style={`top: ${topPx}px; height: ${heightPx}px; transform: ${isBlockDragging ? `translate(${draggedBlockOffset.x.toFixed(1)}px, ${draggedBlockOffset.y.toFixed(1)}px)` : 'none'};`}
                        title={undefined}
                      >
                        {!isEditing ? (
                          data.isAdmin && appt.user_email && !isRestrictedBlock ? (
                            <div mix={adminBlockInnerStyle}>
                              <span mix={adminEmailStyle}>{appt.user_email}</span>
                              <span
                                mix={[blockTitleStyle, isHovered ? expandedTitleStyle : undefined]}
                              >
                                {appt.title}
                              </span>
                            </div>
                          ) : (
                            <span
                              mix={[blockTitleStyle, isHovered ? expandedTitleStyle : undefined]}
                            >
                              {isRestrictedBlock ? '' : appt.title}
                            </span>
                          )
                        ) : null}
                        <textarea
                          aria-label="Termintitel"
                          rows={2}
                          defaultValue={appt.title}
                          mix={[
                            inputStyle,
                            isEditing ? undefined : hiddenStyle,
                            ref((el) => {
                              if (el) {
                                renameInputs.set(appt.id, el)
                              } else {
                                renameInputs.delete(appt.id)
                              }
                            }),
                            on('keydown', (e: any) => {
                              if (e.key === 'Escape') {
                                cancelEdit()
                                return
                              }
                              if (e.key === 'Enter') {
                                if (e.shiftKey) {
                                  e.preventDefault()
                                  commitEdit(appt, csrfToken)
                                }
                                return
                              }
                            }),
                            on('blur', () => cancelEdit()),
                          ]}
                        />
                        {isEditing ? (
                          <div mix={draftButtonsStyle}>
                            <button
                              type="button"
                              aria-label="Save appointment"
                              mix={[
                                draftSaveButtonStyle,
                                on('pointerdown', (e: any) => {
                                  e.preventDefault()
                                  commitEdit(appt, csrfToken)
                                }),
                              ]}
                            >
                              Speichern
                            </button>
                            <button
                              type="button"
                              aria-label="Termin abbrechen"
                              mix={[
                                draftCancelButtonStyle,
                                on('pointerdown', (e: any) => {
                                  e.preventDefault()
                                  cancelEdit()
                                }),
                              ]}
                            >
                              Abbrechen
                            </button>
                          </div>
                        ) : null}
                        {/* Resize handles — only when own block, not dragging or editing */}
                        {!isRestrictedBlock && !isDragging && !isEditing ? (
                          <>
                            <div
                              aria-label="Start verschieben"
                              mix={[
                                resizeHandleStyle,
                                startResizeHandleStyle,
                                isBlockResizing && resizeState?.edge === 'start'
                                  ? activeResizeHandleStyle
                                  : undefined,
                                on('pointerdown', (e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  startResize(appt, 'start', e)
                                }),
                              ]}
                            />
                            <div
                              aria-label="Ende verschieben"
                              mix={[
                                resizeHandleStyle,
                                endResizeHandleStyle,
                                isBlockResizing && resizeState?.edge === 'end'
                                  ? activeResizeHandleStyle
                                  : undefined,
                                on('pointerdown', (e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  startResize(appt, 'end', e)
                                }),
                              ]}
                            />
                          </>
                        ) : null}
                      </div>
                    )
                  })}

                  {/* Ghost block during drag — show where dropped block will land */}
                  {isDragging && preview
                    ? preview.blocks
                        .filter((b) => b.id === dragState?.blockId)
                        .map((ghost) => (
                          <div
                            key="ghost"
                            mix={ghostBlockStyle}
                            style={{
                              top: `${((ghost.start_min - currentOfferingStartMin) / 60) * SLOT_HEIGHT}px`,
                              height: `${Math.max(20, ((ghost.end_min - ghost.start_min) / 60) * SLOT_HEIGHT)}px`,
                            }}
                          />
                        ))
                    : null}

                  {/* Ghost block during type-drag from types panel */}
                  {typeDragPreview &&
                  typeDragPreview.dayIdx === dayIdx &&
                  !isDragging &&
                  !isResizing ? (
                    <div
                      key="type-ghost"
                      mix={typeDragGhostStyle}
                      style={{
                        top: `${((typeDragPreview.startMinute - currentOfferingStartMin) / 60) * SLOT_HEIGHT}px`,
                        height: `${Math.max(20, (15 / 60) * SLOT_HEIGHT)}px`,
                      }}
                    />
                  ) : null}

                  {draftState.active && draftState.dayIdx === dayIdx ? (
                    <div
                      key="draft"
                      mix={draftBlockStyle}
                      style={`top: ${((draftState.start - currentOfferingStartMin) / 60) * SLOT_HEIGHT}px; height: ${Math.max(84, ((draftState.end - draftState.start) / 60) * SLOT_HEIGHT)}px;`}
                    >
                      <textarea
                        aria-label="Neuer Termintitel"
                        rows={2}
                        placeholder="Titel"
                        mix={[
                          inputStyle,
                          ref((el) => {
                            if (el instanceof HTMLTextAreaElement) draftInput = el
                          }),
                          on('keydown', (e: any) => {
                            if (e.key === 'Escape') {
                              cancelDraft()
                              return
                            }
                            if (e.key === 'Enter' && e.shiftKey) {
                              e.preventDefault()
                              commitDraft(csrfToken)
                            }
                          }),
                          on('blur', () => cancelDraft()),
                        ]}
                      />
                      <div mix={draftButtonsStyle}>
                        <button
                          type="button"
                          aria-label="Termin speichern"
                          mix={[
                            draftSaveButtonStyle,
                            on('pointerdown', (e: any) => {
                              e.preventDefault()
                              commitDraft(csrfToken)
                            }),
                          ]}
                        >
                          Speichern
                        </button>
                        <button
                          type="button"
                          aria-label="Termin abbrechen"
                          mix={[
                            draftCancelButtonStyle,
                            on('pointerdown', (e: any) => {
                              e.preventDefault()
                              cancelDraft()
                            }),
                          ]}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    // ── Draft handlers ──

    function startDraft(dayIdx: number, startMin: number) {
      if (draftState.active || activeGesture) return
      draftState.active = true
      syncInteractionState()
      draftState.dayIdx = dayIdx
      draftState.start = startMin
      draftState.end = startMin + 15
      handle.update()
      requestAnimationFrame(() => draftInput?.focus())
    }

    function cancelDraft() {
      draftState.active = false
      syncInteractionState()
      handle.update()
    }

    async function commitDraft(csrfToken: string) {
      if (!draftState.active) return
      let title = (draftInput?.value ?? '').trim()
      if (!title) {
        cancelDraft()
        return
      }

      let date = currentVisibleDays[draftState.dayIdx]?.date ?? 0
      let start = draftState.start
      let end = draftState.end
      let resourceId = readData().selectedResourceId

      draftState.active = false
      syncInteractionState()
      handle.update()

      try {
        let response = await fetch(apptHref, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Csrf-Token': csrfToken,
          },
          body: JSON.stringify({
            title,
            date,
            start_min: start,
            end_min: end,
            resource_id: resourceId,
          }),
          signal: handle.signal,
        })
        if (response.ok || response.status === COLLISION_STATUS || response.status === 403) {
          handleMutationResponse(response)
        }
      } catch {
        // silent
      }
    }

    // ── Edit handlers ──

    function startEdit(appt: { id: number; title: string }) {
      if (editingId !== null || activeGesture) return
      editingId = appt.id
      syncInteractionState()
      handle.update()
      requestAnimationFrame(() => {
        let input = renameInputs.get(appt.id)
        if (input) {
          input.value = appt.title
          input.focus()
          input.select()
        }
      })
    }

    function cancelEdit() {
      editingId = null
      syncInteractionState()
      handle.update()
    }

    function getEditValue(apptId: number): string {
      let input = renameInputs.get(apptId)
      return input ? input.value.trim() : ''
    }

    function commitEdit(appt: { id: number; title: string }, csrfToken: string) {
      if (editingId !== appt.id) return

      let newTitle = getEditValue(appt.id)
      if (!newTitle || newTitle === appt.title) {
        editingId = null
        syncInteractionState()
        handle.update()
        return
      }

      let id = appt.id
      editingId = null
      syncInteractionState()
      handle.update()

      fetch(`${apptHref}/${id}`, {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Csrf-Token': csrfToken,
        },
        body: JSON.stringify({ title: newTitle }),
      })
        .then((r) => {
          if (handleMutationResponse(r)) return
        })
        .catch((err) => console.warn('Failed to update appointment title:', err))
    }

    // ── Block pointer dispatch ──

    function handleBlockPointerDown(appt: AppointmentLayoutBlock, event: PointerEvent) {
      // Ignore if gesture active, draft active, editing, or right-click
      if (activeGesture || draftState.active || editingId !== null || event.button !== 0) return
      // Ignore if target is an input or button
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLButtonElement
      )
        return

      // Foreign blocks are read-only for non-admin users
      let data = readData()
      if (!data.isAdmin && data.currentUserId > 0 && appt.user_id !== data.currentUserId) return

      // Detect double-click via timing (preventDefault kills native dblclick)
      let now = Date.now()
      if (now - lastClick.time < 350 && lastClick.blockId === appt.id) {
        lastClick.time = 0
        startEdit(appt)
        return
      }
      lastClick.time = now
      lastClick.blockId = appt.id

      event.preventDefault()
      startDrag(appt, event)
    }

    // ── Drag handlers ──

    function startDrag(appt: AppointmentLayoutBlock, event: PointerEvent) {
      if (!gridBodyElement) return

      let grid = measureGrid(gridBodyElement)
      let data = readData()
      let dayIdx = currentVisibleDays.findIndex((d) => d.date === appt.date)
      if (dayIdx === -1) dayIdx = 0

      let blockLeft = grid.left + grid.labelWidth + dayIdx * grid.dayWidth
      let blockTop = grid.top + ((appt.start_min - currentOfferingStartMin) / 60) * grid.rowHeight

      dragState = {
        active: true,
        blockId: appt.id,
        grid,
        moved: false,
        offsetX: event.clientX - blockLeft,
        offsetY: event.clientY - blockTop,
        originalBlocks: data.appointments.map(copyAppt),
        placement: { date: appt.date, startMinute: appt.start_min },
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
      }
      activeGesture = 'drag'
      syncInteractionState()
      bindWindowEvents()
      handle.update()
    }

    function moveDrag(event: PointerEvent) {
      if (!dragState || dragState.pointerId !== event.pointerId) return

      let distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY)
      if (!dragState.moved && distance < DRAG_THRESHOLD) return

      dragState.moved = true
      event.preventDefault()

      // Check if pointer is over the trashcan zone
      if (trashcanElement) {
        let rect = trashcanElement.getBoundingClientRect()
        let overTrashcan =
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom
        if (overTrashcan !== isOverTrashcan) {
          isOverTrashcan = overTrashcan
          if (preview) preview = null
          handle.update()
        }
      }

      // Check if pointer is over the left column below the sidebar (types panel area)
      if (!sidebarColElement) {
        sidebarColElement = document.querySelector<HTMLElement>('[data-sidebar-col]')
      }
      if (!sidebarElement) {
        sidebarElement = document.querySelector<HTMLElement>('[data-appointment-sidebar]')
      }
      if (sidebarColElement && sidebarElement) {
        let colRect = sidebarColElement.getBoundingClientRect()
        let sidebarRect = sidebarElement.getBoundingClientRect()
        let overPanel =
          event.clientX >= colRect.left &&
          event.clientX <= colRect.right &&
          event.clientY > sidebarRect.bottom &&
          event.clientY <= colRect.bottom
        if (overPanel !== isOverTypesPanel) {
          isOverTypesPanel = overPanel
          setPanelDropActive(overPanel)
          if (preview) preview = null
          handle.update()
        }
      }

      // When over trashcan or types panel, skip placement preview.
      // Still update draggedBlockOffset so the block tracks the cursor visually.
      if (isOverTrashcan || isOverTypesPanel) {
        if (isOverTypesPanel) {
          let gs = dragState!
          let snappedDay = currentVisibleDays.findIndex((d) => d.date === gs.placement.date)
          if (snappedDay === -1) snappedDay = 0
          let snappedBlockLeft = gs.grid.left + gs.grid.labelWidth + snappedDay * gs.grid.dayWidth
          let snappedBlockTop = gs.grid.top + (gs.placement.startMinute / 60) * gs.grid.rowHeight
          draggedBlockOffset.x = event.clientX - gs.offsetX - snappedBlockLeft
          draggedBlockOffset.y = event.clientY - gs.offsetY - snappedBlockTop
          handle.update()
        }
        return
      }

      let nextPlacement = pointerToPlacement(event, dragState.grid, currentVisibleDays)
      if (!nextPlacement) return

      // Compute visual offset for sub-cell snapping
      let snappedDay = currentVisibleDays.findIndex((d) => d.date === nextPlacement.date)
      if (snappedDay === -1) snappedDay = 0
      let snappedBlockLeft =
        dragState.grid.left + dragState.grid.labelWidth + snappedDay * dragState.grid.dayWidth
      let snappedBlockTop =
        dragState.grid.top + (nextPlacement.startMinute / 60) * dragState.grid.rowHeight
      draggedBlockOffset.x = event.clientX - dragState.offsetX - snappedBlockLeft
      draggedBlockOffset.y = event.clientY - dragState.offsetY - snappedBlockTop

      // Check if placement actually changed
      if (
        nextPlacement.date === dragState.placement.date &&
        nextPlacement.startMinute === dragState.placement.startMinute
      ) {
        handle.update()
        return
      }

      try {
        let nextPreview = previewMoveBlock(
          dragState.originalBlocks,
          dragState.blockId,
          nextPlacement,
          { minimumMinute: currentOfferingStartMin, dayMinutes: currentOfferingEndMin },
        )

        if (nextPreview.unresolved) {
          handle.update()
          return
        }

        dragState.placement = nextPlacement
        preview = nextPreview
        handle.update()
      } catch {
        cancelDrag()
      }
    }

    function cancelDrag() {
      unbindWindowEvents()
      draggedBlockOffset.x = 0
      draggedBlockOffset.y = 0
      preview = null
      dragState = null
      activeGesture = null
      isOverTrashcan = false
      isOverTypesPanel = false
      setPanelDropActive(false)
      sidebarColElement = null
      sidebarElement = null
      handle.update()
    }

    async function endDrag(event: PointerEvent) {
      if (!dragState || dragState.pointerId !== event.pointerId) return

      unbindWindowEvents()

      let blockId = dragState.blockId
      let wasMoved = dragState.moved
      let wasOverTrashcan = isOverTrashcan
      let wasOverTypesPanel = isOverTypesPanel
      // Capture title before dragState is nulled (used in types panel drop)
      let draggedTitle = dragState.originalBlocks.find((b) => b.id === blockId)?.title

      draggedBlockOffset.x = 0
      draggedBlockOffset.y = 0
      dragState = null
      isOverTrashcan = false
      isOverTypesPanel = false
      setPanelDropActive(false)

      // Drop on trashcan → delete appointment
      if (wasOverTrashcan && blockId) {
        activeGesture = null
        syncInteractionState()
        let csrfToken = readData().csrfToken
        preview = null
        handle.update()
        fetch(`${apptHref}/${blockId}`, {
          method: 'DELETE',
          headers: {
            Accept: 'application/json',
            'X-Csrf-Token': csrfToken,
          },
        })
          .then((r) => {
            if (handleMutationResponse(r)) return
          })
          .catch((err) => console.warn('Failed to delete appointment:', err))
        return
      }

      // Drop on types panel → create type from appointment title
      if (wasOverTypesPanel && blockId && draggedTitle) {
        let csrfToken = readData().csrfToken
        preview = null
        handle.update()
        fetch(apptTypesHref, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Csrf-Token': csrfToken,
          },
          body: JSON.stringify({ title: draggedTitle }),
          signal: handle.signal,
        })
          .then((r) => {
            if (r.ok) window.location.reload()
            else showToast('Fehler beim Erstellen des Typs.')
          })
          .catch((err) => {
            if (err instanceof DOMException && err.name === 'AbortError') return
            showToast('Fehler beim Erstellen des Typs.')
          })
        return
      }

      let finalPreview = wasMoved && preview && !preview.unresolved ? preview : null

      if (finalPreview) {
        event.preventDefault()
        // Save ALL changed blocks from solver result — wait for all PUTs before reload
        let saves: Promise<Response>[] = []
        let csrfToken = readData().csrfToken
        for (let change of finalPreview.changes) {
          if ((change.kind === 'moved' || change.kind === 'resized') && change.after) {
            saves.push(saveBlockPosition(change.id, change.after, csrfToken))
          }
        }
        preview = null
        handle.update()
        if (saves.length > 0) {
          let results = await Promise.allSettled(saves)
          activeGesture = null
          syncInteractionState()
          handleBatchMutationResponses(results)
        } else {
          activeGesture = null
          syncInteractionState()
        }
        return
      }

      if (preview) {
        activeGesture = null
        syncInteractionState()
        preview = null
        handle.update()
        return
      }

      activeGesture = null
      syncInteractionState()
      handle.update()
    }

    // ── Resize handlers ──

    function startResize(appt: AppointmentLayoutBlock, edge: 'start' | 'end', event: PointerEvent) {
      if (activeGesture || !gridBodyElement) return
      try {
        let grid = measureGrid(gridBodyElement)
        let data = readData()

        resizeState = {
          active: true,
          blockId: appt.id,
          edge,
          grid,
          moved: false,
          offsetY:
            event.clientY -
            (grid.top +
              (((edge === 'end' ? appt.end_min : appt.start_min) - currentOfferingStartMin) / 60) *
                grid.rowHeight),
          originalBlock: copyAppt(appt),
          originalBlocks: data.appointments.map(copyAppt),
          pointerId: event.pointerId,
          startY: event.clientY,
        }
        activeGesture = 'resize'
        syncInteractionState()
        bindWindowEvents()
      } catch (e) {
        console.error('[AppointmentGrid] startResize error:', e)
        cancelResize()
        return
      }
      handle.update()
    }

    function moveResize(event: PointerEvent) {
      if (!resizeState || resizeState.pointerId !== event.pointerId) return

      let distance = Math.abs(event.clientY - resizeState.startY)
      if (!resizeState.moved && distance < DRAG_THRESHOLD) return

      resizeState.moved = true
      event.preventDefault()

      try {
        let edgeMinute = pointerToResizeMinute(event, resizeState)
        let nextPreview = previewResizeBlockTime(
          resizeState.originalBlocks,
          resizeState.blockId,
          { edge: resizeState.edge, minute: edgeMinute },
          { minimumMinute: currentOfferingStartMin, dayMinutes: currentOfferingEndMin },
        )

        if (nextPreview.unresolved) return

        preview = nextPreview
        handle.update()
      } catch {
        cancelResize()
      }
    }

    function cancelResize() {
      unbindWindowEvents()
      preview = null
      resizeState = null
      activeGesture = null
      syncInteractionState()
      handle.update()
    }

    async function endResize(event: PointerEvent) {
      if (!resizeState || resizeState.pointerId !== event.pointerId) return

      unbindWindowEvents()
      let finalPreview = resizeState.moved && preview && !preview.unresolved ? preview : null
      resizeState = null

      if (finalPreview) {
        event.preventDefault()
        let saves: Promise<Response>[] = []
        let csrfToken = readData().csrfToken
        for (let change of finalPreview.changes) {
          if ((change.kind === 'resized' || change.kind === 'moved') && change.after) {
            saves.push(saveBlockPosition(change.id, change.after, csrfToken))
          }
        }
        preview = null
        handle.update()
        if (saves.length > 0) {
          let results = await Promise.allSettled(saves)
          activeGesture = null
          syncInteractionState()
          handleBatchMutationResponses(results)
        } else {
          activeGesture = null
          syncInteractionState()
        }
        return
      }

      if (preview) {
        activeGesture = null
        syncInteractionState()
        preview = null
        handle.update()
        return
      }

      handle.update()
    }

    // ── Window event binding ──

    function bindWindowEvents() {
      window.addEventListener('pointermove', onWindowPointerMove)
      window.addEventListener('pointerup', onWindowPointerEnd)
      window.addEventListener('pointercancel', onWindowPointerCancel)
    }

    function unbindWindowEvents() {
      window.removeEventListener('pointermove', onWindowPointerMove)
      window.removeEventListener('pointerup', onWindowPointerEnd)
      window.removeEventListener('pointercancel', onWindowPointerCancel)
    }

    function onWindowPointerMove(event: PointerEvent) {
      if (activeGesture === 'drag') {
        moveDrag(event)
      } else if (activeGesture === 'resize') {
        moveResize(event)
      }
    }

    function onWindowPointerEnd(event: PointerEvent) {
      if (activeGesture === 'drag') {
        endDrag(event)
      } else if (activeGesture === 'resize') {
        endResize(event)
      }
    }

    function onWindowPointerCancel(event: PointerEvent) {
      // pointercancel = system interrupted gesture — revert, don't save
      if (activeGesture === 'drag') {
        cancelDrag()
      } else if (activeGesture === 'resize') {
        cancelResize()
      }
    }

    // ── Save ──

    function saveBlockPosition(
      id: number,
      after: AppointmentLayoutBlock,
      csrfToken: string,
    ): Promise<Response> {
      return fetch(`${apptHref}/${id}`, {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Csrf-Token': csrfToken,
        },
        body: JSON.stringify({
          date: after.date,
          start_min: after.start_min,
          end_min: after.end_min,
        }),
      })
    }

    // ── Type-drag handlers (from appointtype panel) ──

    function onTypeDragMove(event: PointerEvent) {
      let state = getTypeDragState()
      if (activeGesture || draftState.active || editingId !== null) return
      if (!state?.active || !gridBodyElement) return

      let grid = measureGrid(gridBodyElement)

      // Compute snapped grid position (cursor point, no offset since not dragging a block)
      let rawDay = (event.clientX - grid.left - grid.labelWidth) / grid.dayWidth
      let dayIdx = clamp(Math.round(rawDay), 0, currentVisibleDays.length - 1)
      let date = currentVisibleDays[dayIdx]?.date
      if (!date) {
        clearTypeDragPreview()
        return
      }

      let rawMinute = ((event.clientY - grid.top) / grid.rowHeight) * 60 + currentOfferingStartMin
      let startMinute = clamp(
        Math.round(rawMinute / 15) * 15,
        currentOfferingStartMin,
        currentOfferingEndMin - 15,
      )

      if (
        typeDragPreview &&
        typeDragPreview.date === date &&
        typeDragPreview.startMinute === startMinute
      )
        return

      typeDragPreview = { date, startMinute, dayIdx }
      handle.update()
    }

    function onTypeDragEnd(_event: PointerEvent) {
      let state = getTypeDragState()
      if (!state?.active) return

      let preview = typeDragPreview
      clearTypeDragPreview()

      if (preview) {
        let data = readData()
        let csrfToken = data.csrfToken
        fetch(apptHref, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Csrf-Token': csrfToken,
          },
          body: JSON.stringify({
            typeId: state.typeId,
            date: preview.date,
            start_min: preview.startMinute,
            resource_id: data.selectedResourceId,
          }),
          signal: handle.signal,
        })
          .then((r) => {
            if (handleMutationResponse(r)) return
            showToast('Fehler beim Erstellen des Termins.')
          })
          .catch((err) => {
            if (err instanceof DOMException && err.name === 'AbortError') return
            showToast('Fehler beim Erstellen des Termins.')
          })
      }

      setTypeDragState(null)
    }

    function onTypeDragCancel() {
      clearTypeDragPreview()
      if (getTypeDragState()) setTypeDragState(null)
    }

    function clearTypeDragPreview() {
      if (typeDragPreview) {
        typeDragPreview = null
        handle.update()
      }
    }

    // ── Grid measurement ──

    function measureGrid(element: HTMLElement): GridMeasurement {
      let rect = element.getBoundingClientRect()
      let numDays = currentVisibleDays.length || 1
      return {
        dayWidth: Math.max(1, (rect.width - LABEL_WIDTH) / numDays),
        labelWidth: LABEL_WIDTH,
        left: rect.left,
        rowHeight: SLOT_HEIGHT,
        top: rect.top,
      }
    }

    // ── Pointer helpers ──

    function pointerToPlacement(
      event: PointerEvent,
      grid: GridMeasurement,
      days: AppData['days'],
    ): { date: number; startMinute: number } | null {
      let blockLeft = event.clientX - (dragState?.offsetX ?? 0)
      let blockTop = event.clientY - (dragState?.offsetY ?? 0)

      let rawDay = (blockLeft - grid.left - grid.labelWidth) / grid.dayWidth
      let dayIdx = clamp(Math.round(rawDay), 0, days.length - 1)
      let date = days[dayIdx]?.date
      if (!date) return null

      // Grid rows begin at currentOfferingStartMin, so add the offset
      let rawMinute = ((blockTop - grid.top) / grid.rowHeight) * 60 + currentOfferingStartMin
      let snappedMinute = Math.round(rawMinute / 15) * 15
      let startMinute = clamp(snappedMinute, currentOfferingStartMin, currentOfferingEndMin - 15)

      return { date, startMinute }
    }

    function pointerToResizeMinute(event: PointerEvent, state: ResizeState): number {
      let edgeY = event.clientY - state.offsetY
      // Grid rows begin at currentOfferingStartMin, so add the offset
      let rawMinute =
        ((edgeY - state.grid.top) / state.grid.rowHeight) * 60 + currentOfferingStartMin
      let snapped = Math.round(rawMinute / 15) * 15

      if (state.edge === 'start') {
        return clamp(snapped, currentOfferingStartMin, state.originalBlock.end_min - 15)
      }
      return clamp(snapped, state.originalBlock.start_min + 15, currentOfferingEndMin)
    }
  },
)
