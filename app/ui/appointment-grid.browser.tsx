import { clientEntry, on, ref, type Handle } from 'remix/component'
import { spring } from '@remix-run/ui/animation'
import { Glyph } from '../ui/theme/glyph/glyph.tsx'

import {
  previewMoveBlock,
  previewResizeBlockTime,
  type AppointmentLayoutBlock,
  type LayoutResult,
} from './schedule-layout.ts'
import {
  getTypeDragState,
  setTypeDragState,
  setPanelDropActive,
} from '../utils/appointtype-drag.ts'
import { interactionState } from './appointment-interaction-state.ts'
import { showToast } from './toast.ts'
import { clamp } from '../utils/math.ts'
import { prefersReducedMotion } from '../utils/motion.ts'

import {
  LABEL_WIDTH,
  DRAG_THRESHOLD,
  COLLISION_STATUS,
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
} from './appointment-grid-styles.ts'

type AppointmentGridProps = {
  /**
   * Serializable grid data. The page passes it so the server renders the real
   * layout (guide 05 § "Progressive enhancement"); client-only mounts and tests
   * may omit it and fall back to the embedded `#appointment-data` script.
   */
  data?: AppData
}

export const AppointmentGrid = clientEntry(
  import.meta.url + '#AppointmentGrid',
  function AppointmentGrid(handle: Handle<AppointmentGridProps>) {
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

    /**
     * Grid data for the current render. Props are the server-rendered source;
     * `readData()` remains the DOM fallback for client-only mounts and tests.
     */
    function currentData(): AppData {
      return handle.props.data ?? readData()
    }

    // Sync interaction state for SSE subscriber
    function syncInteractionState() {
      interactionState.active = activeGesture !== null || editingId !== null || draftState.active
    }
    let gridBodyElement: HTMLElement | null = null
    let draggedBlockOffset = { x: 0, y: 0 }
    // Release-velocity samples for the drop settle animation (guides.remix.run/
    // animation drag-release pattern): rate of change of the dragged block
    // offset in px/ms. Sampled at ≥8ms intervals so pointer-event jitter
    // between coalesced moves doesn't produce wild velocities.
    let dragVelocity = { x: 0, y: 0 }
    let lastOffsetSample = { x: 0, y: 0, t: 0 }
    let isOverTrashcan = false
    let isOverTypesPanel = false
    // Corrected to the browser's local calendar day after the first commit.
    let localTodayMs: number | null = null
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
    // Offering time range for positioning calculations — the grid rows start
    // at currentOfferingStartMin, so all absolute pixel positions must be
    // relative to this offset rather than absolute midnight.
    let currentOfferingStartMin = 0
    let currentOfferingEndMin = 1440

    // The server renders its UTC day (props) so hydration matches; after the
    // commit, move the "today" highlight to the browser's local day when the
    // two disagree (guide 05: browser-only setup belongs in a queued task).
    handle.queueTask(() => {
      let serverToday = handle.props.data?.todayMs
      if (serverToday === undefined) return
      let now = new Date()
      let localToday = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
      if (localToday === serverToday) return
      localTodayMs = localToday
      void handle.update()
    })

    // Always-active listeners for type-drag from types panel (client-side only)
    if (typeof document !== 'undefined') {
      document.addEventListener('pointermove', onTypeDragMove, { signal: handle.signal })
      document.addEventListener('pointerup', onTypeDragEnd, { signal: handle.signal })
      document.addEventListener('pointercancel', onTypeDragCancel, { signal: handle.signal })
    }

    return () => {
      let data = currentData()
      let days = data.days
      let offerings = data.offerings ?? []
      let csrfToken = data.csrfToken
      apptHref = data.appointmentHref ?? ''
      apptTypesHref = data.appointmentTypesHref ?? ''

      let todayMs =
        localTodayMs ??
        data.todayMs ??
        (() => {
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
      let excludeApptId =
        activeGesture === 'drag'
          ? dragState?.blockId
          : activeGesture === 'resize'
            ? resizeState?.blockId
            : undefined
      let bookableAppts =
        excludeApptId !== undefined
          ? data.appointments.filter((a) => a.id !== excludeApptId)
          : data.appointments
      let { allBookableMinutes, bookableByDay } = computeBookableSlots(
        offerings,
        visibleDays,
        bookableAppts,
      )
      let offeringRange = computeOfferingTimeRange(offerings)

      // Store visible days and offering range for event handler access
      currentVisibleDays = visibleDays
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
          <div data-appointment-grid mix={emptyStateWrapperStyle}>
            <p mix={emptyStateTextStyle}>No bookable slots this week.</p>
          </div>
        )
      }

      let numDays = visibleDays.length
      let gridTemplateCols = `${LABEL_WIDTH}px repeat(${numDays}, 1fr)`

      return (
        <div
          aria-label="Wöchentliche Terminübersicht"
          data-appointment-grid
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
                <div key={i} data-day-date={day.date} mix={dayHeaderStyle}>
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

                  {groups[dayIdx]!.map((appt) => {
                    let isEditing = editingId === appt.id
                    let isForeign = data.currentUserId > 0 && appt.user_id !== data.currentUserId
                    let isCurrentUser =
                      data.currentUserId > 0 && appt.user_id === data.currentUserId
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
                            void handle.update()
                          }),
                          on('mouseleave', () => {
                            if (isRestrictedBlock) return
                            hoveredBlockId = null
                            void handle.update()
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
                            on('keydown', (e) => {
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
                                on('pointerdown', (e) => {
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
                                on('pointerdown', (e) => {
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
                          on('keydown', (e) => {
                            if (e.key === 'Escape') {
                              cancelDraft()
                              return
                            }
                            if (e.key === 'Enter' && e.shiftKey) {
                              e.preventDefault()
                              void commitDraft(csrfToken)
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
                            on('pointerdown', (e) => {
                              e.preventDefault()
                              void commitDraft(csrfToken)
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
                            on('pointerdown', (e) => {
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
      void handle.update()
      handle.queueTask(() => draftInput?.focus())
    }

    function cancelDraft() {
      draftState.active = false
      syncInteractionState()
      void handle.update()
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
      let resourceId = currentData().selectedResourceId

      draftState.active = false
      syncInteractionState()
      void handle.update()

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
      void handle.update()
      handle.queueTask(() => {
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
      void handle.update()
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
        void handle.update()
        return
      }

      let id = appt.id
      editingId = null
      syncInteractionState()
      void handle.update()

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
      let data = currentData()
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
      let data = currentData()
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
      // Reset release-velocity sampling for this gesture.
      dragVelocity = { x: 0, y: 0 }
      lastOffsetSample = { x: draggedBlockOffset.x, y: draggedBlockOffset.y, t: performance.now() }
      bindWindowEvents()
      void handle.update()
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
          void handle.update()
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
          void handle.update()
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
          recordDragVelocity(draggedBlockOffset.x, draggedBlockOffset.y)
          void handle.update()
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
      recordDragVelocity(draggedBlockOffset.x, draggedBlockOffset.y)

      // Check if placement actually changed
      if (
        nextPlacement.date === dragState.placement.date &&
        nextPlacement.startMinute === dragState.placement.startMinute
      ) {
        void handle.update()
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
          void handle.update()
          return
        }

        dragState.placement = nextPlacement
        preview = nextPreview
        void handle.update()
      } catch {
        cancelDrag()
      }
    }

    function recordDragVelocity(x: number, y: number) {
      let now = performance.now()
      let dt = now - lastOffsetSample.t
      if (dt < 8) return
      dragVelocity.x = (x - lastOffsetSample.x) / dt
      dragVelocity.y = (y - lastOffsetSample.y) / dt
      lastOffsetSample = { x, y, t: now }
    }

    /**
     * Spring velocity (progress units per second, clamped to ±20 like the
     * guide's drag-release demo) along the offset axis with the larger
     * distance. The spring runs from the drop offset toward 0, so a shrinking
     * offset means positive velocity.
     */
    function settleVelocity(fromX: number, fromY: number): number {
      let useX = Math.abs(fromX) >= Math.abs(fromY)
      let distance = Math.max(useX ? Math.abs(fromX) : Math.abs(fromY), 1)
      let velocity = useX ? dragVelocity.x : dragVelocity.y
      return clamp((-velocity * 1000) / distance, -20, 20)
    }

    /**
     * Animate a dropped block from its last drag offset into its committed
     * slot with a spring. WAAPI overrides the inline transform during play;
     * the rendered inline value is already `none`, so the block rests in its
     * slot when the animation ends. Degradation is graceful: if a refresh
     * rebuilds the node mid-animation, the block just appears in place.
     */
    function startSettleAnimation(blockId: number) {
      if (prefersReducedMotion()) return
      let fromX = draggedBlockOffset.x
      let fromY = draggedBlockOffset.y
      if (fromX === 0 && fromY === 0) return
      let node = gridBodyElement?.querySelector<HTMLElement>(`[data-block-id="${blockId}"]`)
      if (!node) return
      node.animate(
        [
          { transform: `translate(${fromX.toFixed(1)}px, ${fromY.toFixed(1)}px)` },
          { transform: 'none' },
        ],
        { ...spring('snappy', { velocity: settleVelocity(fromX, fromY) }) },
      )
    }

    function cancelDrag() {
      unbindWindowEvents()
      if (dragState?.blockId) startSettleAnimation(dragState.blockId)
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
      void handle.update()
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

      // Settle the block into its committed slot — except on trashcan or
      // types-panel drops, where the block is deleted or replaced.
      if (!(wasOverTrashcan || wasOverTypesPanel)) startSettleAnimation(blockId)
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
        let csrfToken = currentData().csrfToken
        preview = null
        void handle.update()
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
        let csrfToken = currentData().csrfToken
        preview = null
        void handle.update()
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
        let csrfToken = currentData().csrfToken
        for (let change of finalPreview.changes) {
          if ((change.kind === 'moved' || change.kind === 'resized') && change.after) {
            saves.push(saveBlockPosition(change.id, change.after, csrfToken))
          }
        }
        preview = null
        void handle.update()
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
        void handle.update()
        return
      }

      activeGesture = null
      syncInteractionState()
      void handle.update()
    }

    // ── Resize handlers ──

    function startResize(appt: AppointmentLayoutBlock, edge: 'start' | 'end', event: PointerEvent) {
      if (activeGesture || !gridBodyElement) return
      try {
        let grid = measureGrid(gridBodyElement)
        let data = currentData()

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
      void handle.update()
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
        void handle.update()
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
      void handle.update()
    }

    async function endResize(event: PointerEvent) {
      if (!resizeState || resizeState.pointerId !== event.pointerId) return

      unbindWindowEvents()
      let finalPreview = resizeState.moved && preview && !preview.unresolved ? preview : null
      resizeState = null

      if (finalPreview) {
        event.preventDefault()
        let saves: Promise<Response>[] = []
        let csrfToken = currentData().csrfToken
        for (let change of finalPreview.changes) {
          if ((change.kind === 'resized' || change.kind === 'moved') && change.after) {
            saves.push(saveBlockPosition(change.id, change.after, csrfToken))
          }
        }
        preview = null
        void handle.update()
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
        void handle.update()
        return
      }

      void handle.update()
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
        void endDrag(event)
      } else if (activeGesture === 'resize') {
        void endResize(event)
      }
    }

    function onWindowPointerCancel(_event: PointerEvent) {
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
      void handle.update()
    }

    function onTypeDragEnd(_event: PointerEvent) {
      let state = getTypeDragState()
      if (!state?.active) return

      let typePreview = typeDragPreview
      clearTypeDragPreview()

      if (typePreview) {
        let data = currentData()
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
            date: typePreview.date,
            start_min: typePreview.startMinute,
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
        void handle.update()
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
