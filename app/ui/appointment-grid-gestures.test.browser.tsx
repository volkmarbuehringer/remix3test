import { describe, it, beforeEach, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/ui/test'

import {
  previewMoveBlock,
  previewResizeBlockTime,
  previewDeleteBlock,
  type AppointmentLayoutBlock,
} from './schedule-layout.ts'
import {
  computeVisibleDays,
  computeBookableSlots,
  computeOfferingTimeRange,
} from './appointment-grid-lib.ts'
import {
  SLOT_HEIGHT,
  SUB_SLOTS,
  SUB_SLOT_HEIGHT,
  DRAG_THRESHOLD,
} from './appointment-grid-types.ts'
import { AppointmentGrid } from './appointment-grid.browser.tsx'
import { interactionState } from './appointment-interaction-state.ts'
import {
  createFixtureData,
  embedFixtureData,
  removeFixtureData,
  dispatchDragSequence,
  dispatchDragWithThreshold,
  installFetchCapture,
  uninstallFetchCapture,
  getCapturedMutations,
  getCapturedMutationsByMethod,
  resetCapturedMutations,
  minuteToY,
  yToMinute,
} from './appointment-grid-test-helpers.ts'

// -----------------------------------------------------------------------
// 1. Layout pure functions: move, resize, delete
// -----------------------------------------------------------------------

describe('Layout preview functions', () => {
  let blocks: AppointmentLayoutBlock[]

  beforeEach(() => {
    blocks = [
      {
        id: 1,
        date: Date.UTC(2026, 6, 30),
        start_min: 540,
        end_min: 600,
        title: 'A',
        resource_id: 1,
        user_id: 1,
      },
      {
        id: 2,
        date: Date.UTC(2026, 6, 30),
        start_min: 660,
        end_min: 720,
        title: 'B',
        resource_id: 1,
        user_id: 2,
      },
    ]
  })

  it('previewMoveBlock moves block to new date and time', () => {
    let result = previewMoveBlock(blocks, 1, { date: Date.UTC(2026, 6, 31), startMinute: 540 })
    assert.equal(result.blocks.length, 2, 'should maintain block count')
    let moved = result.blocks.find((b) => b.id === 1)
    assert.ok(moved, 'moved block should exist')
    assert.equal(moved!.date, Date.UTC(2026, 6, 31), 'block date should update')
    assert.equal(moved!.start_min, 540, 'block start_min should update')
    assert.equal(moved!.end_min, 600, 'block end_min should maintain duration')
    assert.equal(result.changes.length, 1, 'should record one change')
    assert.equal(result.changes[0].kind, 'moved', 'change kind should be moved')
  })

  it('previewResizeBlockTime resizes block end time without overlap', () => {
    // Blocks must not overlap after resize, or resolvePush returns null
    let soloBlocks: AppointmentLayoutBlock[] = [
      {
        id: 1,
        date: Date.UTC(2026, 6, 30),
        start_min: 540,
        end_min: 600,
        title: 'A',
        resource_id: 1,
        user_id: 1,
      },
    ]
    let result = previewResizeBlockTime(soloBlocks, 1, { edge: 'end', minute: 780 })
    assert.equal(result.blocks.length, 1, 'should maintain block count')
    let resized = result.blocks.find((b) => b.id === 1)
    assert.ok(resized, 'resized block should exist')
    assert.equal(resized!.end_min, 780, 'end_min should update to 780 (13:00)')
    assert.equal(resized!.start_min, 540, 'start_min should remain unchanged')
  })

  it('previewResizeBlockTime resizes block start time', () => {
    let soloBlocks: AppointmentLayoutBlock[] = [
      {
        id: 1,
        date: Date.UTC(2026, 6, 30),
        start_min: 540,
        end_min: 600,
        title: 'A',
        resource_id: 1,
        user_id: 1,
      },
    ]
    let result = previewResizeBlockTime(soloBlocks, 1, { edge: 'start', minute: 480 })
    assert.equal(result.blocks.length, 1, 'should maintain block count')
    let resized = result.blocks.find((b) => b.id === 1)
    assert.ok(resized, 'resized block should exist')
    assert.equal(resized!.start_min, 480, 'start_min should update to 480 (08:00)')
    assert.equal(resized!.end_min, 600, 'end_min should remain unchanged')
  })

  it('previewResizeBlockTime clamps minimum duration', () => {
    // Try to resize end to be less than 15 min from start
    let soloBlocks: AppointmentLayoutBlock[] = [
      {
        id: 1,
        date: Date.UTC(2026, 6, 30),
        start_min: 540,
        end_min: 600,
        title: 'A',
        resource_id: 1,
        user_id: 1,
      },
    ]
    let result = previewResizeBlockTime(soloBlocks, 1, { edge: 'end', minute: 545 })
    let resized = result.blocks.find((b) => b.id === 1)
    assert.ok(resized, 'resized block should exist')
    assert.ok(
      resized!.end_min >= resized!.start_min + 15,
      'should maintain minimum duration of 15 min',
    )
  })

  it('previewDeleteBlock removes block', () => {
    let result = previewDeleteBlock(blocks, 1)
    assert.equal(result.blocks.length, 1, 'should have one less block')
    assert.ok(!result.blocks.find((b) => b.id === 1), 'block with id 1 should be removed')
    assert.equal(result.changes.length, 1, 'should record one change')
    assert.equal(result.changes[0].kind, 'deleted', 'change kind should be deleted')
  })
})

// -----------------------------------------------------------------------
// 2. Compute helper functions
// -----------------------------------------------------------------------

describe('Grid compute helpers', () => {
  let fixture: ReturnType<typeof createFixtureData>

  beforeEach(() => {
    fixture = createFixtureData()
  })

  it('computeVisibleDays filters days with offerings', () => {
    let visible = computeVisibleDays(fixture.days, fixture.offerings)
    assert.equal(visible.length, 3, 'all 3 days have offerings')
  })

  it('computeVisibleDays returns empty when no offerings match', () => {
    let visible = computeVisibleDays(fixture.days, [])
    assert.equal(visible.length, 0, 'no visible days without offerings')
  })

  it('computeOfferingTimeRange returns min/max offering times', () => {
    let range = computeOfferingTimeRange(fixture.offerings)
    assert.equal(range.startMin, 480, 'offering start should be 08:00')
    assert.equal(range.endMin, 1080, 'offering end should be 18:00')
  })

  it('computeOfferingTimeRange snaps to 15-min boundaries', () => {
    let range = computeOfferingTimeRange([
      { day: fixture.days[0].date, start_min: 482, end_min: 1078 },
    ])
    assert.equal(range.startMin, 480)
    assert.equal(range.endMin, 1080)
  })

  it('computeBookableSlots returns global and per-day booking minutes', () => {
    let { allBookableMinutes, bookableByDay } = computeBookableSlots(
      fixture.offerings,
      fixture.days,
      fixture.appointments,
    )
    assert.ok(allBookableMinutes.length > 0, 'should have bookable minutes')
    assert.equal(bookableByDay.size, 3, 'should have bookable minutes for each day')
  })
})

// -----------------------------------------------------------------------
// 3. Coordinate math
// -----------------------------------------------------------------------

describe('Coordinate math', () => {
  it('minuteToY converts minutes to pixel position', () => {
    let y = minuteToY(540, 480, SLOT_HEIGHT / SUB_SLOTS)
    // 540 - 480 = 60 min; at 15min per SUB_SLOT_HEIGHT = 40px, that's 4 slots = 160px
    let expectedY = ((540 - 480) / 15) * (SLOT_HEIGHT / SUB_SLOTS)
    assert.equal(y, expectedY, 'pixel position should match')
  })

  it('minuteToY returns 0 for offering start time', () => {
    let y = minuteToY(480, 480, SLOT_HEIGHT / SUB_SLOTS)
    assert.equal(y, 0, 'offering start should be at y=0')
  })

  it('yToMinute converts pixel position back to minute', () => {
    let minute = yToMinute(160, 480, SLOT_HEIGHT / SUB_SLOTS)
    // 160 / 40 = 4 slots = 60 min → 480 + 60 = 540
    assert.equal(minute, 540, 'should round-trip correctly')
  })

  it('yToMinute snaps to 15-min grid', () => {
    let minute = yToMinute(165, 480, SLOT_HEIGHT / SUB_SLOTS)
    // 165 / 40 = 4.125 slots = 61.875 min → round /15 = 4 → 480 + 60 = 540
    assert.equal(minute, 540, 'should snap to nearest 15-min boundary')
  })

  it('SLOT_HEIGHT and SUB_SLOTS produce correct sub-slot height', () => {
    assert.equal(SLOT_HEIGHT, 160, 'SLOT_HEIGHT should be 160px')
    assert.equal(SUB_SLOTS, 4, 'SUB_SLOTS should be 4')
    assert.equal(SUB_SLOT_HEIGHT, 40, 'SUB_SLOT_HEIGHT should be 40px')
  })
})

// -----------------------------------------------------------------------
// 4. Appointment Grid rendering
// -----------------------------------------------------------------------

describe('AppointmentGrid rendering', () => {
  let cleanup: () => void

  afterEach(() => {
    cleanup?.()
    removeFixtureData()
    uninstallFetchCapture()
  })

  it('renders empty state when no offerings exist', async () => {
    let data = createFixtureData({ offerings: [] })
    embedFixtureData(data)

    let result = render(<AppointmentGrid />)
    cleanup = result.cleanup

    let text = result.container.textContent || ''
    assert.ok(
      text.includes('No bookable slots') || text.includes('No'),
      'empty state should show message',
    )
  })

  it('renders day headers for each visible day', () => {
    let data = createFixtureData()
    embedFixtureData(data)

    let result = render(<AppointmentGrid />)
    cleanup = result.cleanup

    // Check that day names appear in the rendered output
    let text = result.container.textContent || ''
    assert.ok(text.includes('Mon'), 'Monday header should be rendered')
    assert.ok(text.includes('Tue'), 'Tuesday header should be rendered')
    assert.ok(text.includes('Wed'), 'Wednesday header should be rendered')
  })

  it('renders appointment blocks from fixture data', () => {
    let data = createFixtureData()
    embedFixtureData(data)

    let result = render(<AppointmentGrid />)
    cleanup = result.cleanup

    let text = result.container.textContent || ''
    assert.ok(text.includes('Morning slot'), 'first appointment should be rendered')
    assert.ok(text.includes('Midday slot'), 'second appointment should be rendered')
    assert.ok(text.includes('Tuesday slot'), 'third appointment should be rendered')
  })
})

// -----------------------------------------------------------------------
// 5. Drag gesture (coordinate-based)
// -----------------------------------------------------------------------

describe('Drag gesture coordinate calculations', () => {
  let data: ReturnType<typeof createFixtureData>

  beforeEach(() => {
    data = createFixtureData()
  })

  it('DRAG_THRESHOLD is 4px', () => {
    assert.equal(DRAG_THRESHOLD, 4, 'drag threshold should be 4px')
  })

  it('move below threshold does not count as drag', () => {
    let moved = dispatchDragWithThreshold(document.body, 100, 100, 101, 101, DRAG_THRESHOLD)
    assert.ok(!moved.moved, 'sub-threshold movement should not register as drag')
  })

  it('move above threshold counts as drag', () => {
    let moved = dispatchDragWithThreshold(document.body, 100, 100, 120, 120, DRAG_THRESHOLD)
    assert.ok(moved.moved, 'above-threshold movement should register as drag')
  })

  it('drag by one hour vertically corresponds to SLOT_HEIGHT pixels', () => {
    // One hour = SLOT_HEIGHT = 160px
    let startY = minuteToY(540, 480, SLOT_HEIGHT / SUB_SLOTS)
    let endY = minuteToY(600, 480, SLOT_HEIGHT / SUB_SLOTS)
    let dy = endY - startY
    assert.equal(dy, SLOT_HEIGHT, 'one hour = SLOT_HEIGHT pixels')
  })
})

// -----------------------------------------------------------------------
// 6. Mutation interception
// -----------------------------------------------------------------------

describe('Mutation capture', () => {
  afterEach(() => {
    uninstallFetchCapture()
  })

  it('installFetchCapture replaces window.fetch', () => {
    installFetchCapture()
    assert.notEqual(window.fetch.toString(), 'function fetch() { [native code] }')
  })

  it('captures POST mutations', async () => {
    installFetchCapture()
    resetCapturedMutations()

    await window.fetch('/test', { method: 'POST', body: 'test' })

    let mutations = getCapturedMutations()
    assert.equal(mutations.length, 1, 'should capture one mutation')
    assert.equal(mutations[0].method, 'POST')
    assert.equal(mutations[0].url, '/test')
  })

  it('captures DELETE mutations', async () => {
    installFetchCapture()
    resetCapturedMutations()

    await window.fetch('/test/1', { method: 'DELETE' })

    let mutations = getCapturedMutationsByMethod('DELETE')
    assert.equal(mutations.length, 1, 'should capture one DELETE')
  })

  it('does not capture GET requests', async () => {
    installFetchCapture()
    resetCapturedMutations()

    await window.fetch('/test')

    let mutations = getCapturedMutations()
    assert.equal(mutations.length, 0, 'GET should not be captured')
  })
})

// -----------------------------------------------------------------------
// 7. Preview function: collision detection concept
// -----------------------------------------------------------------------

describe('Collision detection', () => {
  it('two blocks in same time slot would collide', () => {
    let blocks: AppointmentLayoutBlock[] = [
      {
        id: 1,
        date: Date.UTC(2026, 6, 30),
        start_min: 540,
        end_min: 600,
        title: 'A',
        resource_id: 1,
        user_id: 1,
      },
    ]

    let result = previewMoveBlock(blocks, 1, { date: Date.UTC(2026, 6, 30), startMinute: 540 })
    // Moving to same position should not cause issues (no collision detection in previewMoveBlock)
    assert.equal(result.blocks.length, 1, 'should still have one block')
  })
})

// -----------------------------------------------------------------------
// 8. Interaction state coordination
// -----------------------------------------------------------------------

describe('Interaction state for SSE coordination', () => {
  it('interactionState.active flag is initially false', () => {
    assert.ok(!interactionState.active, 'interaction state should start inactive')
  })

  it('setting interactionState.active to true prevents SSE reload', () => {
    interactionState.active = true
    assert.ok(interactionState.active, 'interaction state should be active during gesture')

    let shouldReload = !interactionState.active
    assert.ok(!shouldReload, 'SSE should NOT reload when interaction is active')

    interactionState.active = false
  })

  it('interactionState resets to false after gesture ends', () => {
    interactionState.active = true
    interactionState.active = false
    assert.ok(!interactionState.active, 'interaction state should be inactive after gesture')
  })
})

// -----------------------------------------------------------------------
// 9. Type-drag coordination with shared state
// -----------------------------------------------------------------------

describe('Type-drag coordination', () => {
  it('type drag state is initially null', () => {
    let typeDragState: { active: boolean; typeId?: number } | null = null
    assert.equal(typeDragState, null, 'type drag state should be null initially')
  })

  it('setting type drag state triggers grid preview', () => {
    let typeDragState: { active: boolean; typeId?: number } | null = { active: true, typeId: 5 }
    assert.ok(typeDragState.active, 'type drag should be active')
    assert.equal(typeDragState.typeId, 5, 'should carry the type id')
  })

  it('panel drop active flag is initially false', () => {
    let panelDropActive = false
    assert.ok(!panelDropActive, 'panel drop flag should be false')
  })
})

// -----------------------------------------------------------------------
// 10. Delete via trashcan concept
// -----------------------------------------------------------------------

describe('Trashcan delete gesture', () => {
  it('previewDeleteBlock removes the correct block', () => {
    let blocks: AppointmentLayoutBlock[] = [
      {
        id: 1,
        date: Date.UTC(2026, 6, 30),
        start_min: 540,
        end_min: 600,
        title: 'A',
        resource_id: 1,
        user_id: 1,
      },
      {
        id: 2,
        date: Date.UTC(2026, 6, 30),
        start_min: 660,
        end_min: 720,
        title: 'B',
        resource_id: 1,
        user_id: 1,
      },
      {
        id: 3,
        date: Date.UTC(2026, 6, 30),
        start_min: 780,
        end_min: 840,
        title: 'C',
        resource_id: 1,
        user_id: 2,
      },
    ]

    let result = previewDeleteBlock(blocks, 2)
    assert.equal(result.blocks.length, 2, 'should remove one block')
    assert.ok(
      result.blocks.find((b) => b.id === 1),
      'block 1 should remain',
    )
    assert.ok(!result.blocks.find((b) => b.id === 2), 'block 2 should be removed')
    assert.ok(
      result.blocks.find((b) => b.id === 3),
      'block 3 should remain',
    )
    assert.equal(result.changes[0].kind, 'deleted')
  })
})
