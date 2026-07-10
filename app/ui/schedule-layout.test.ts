import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import type { AppointmentLayoutBlock } from './schedule-layout.ts'
import {
  previewDeleteBlock,
  previewMoveBlock,
  previewResizeBlockTime,
  defaultLayoutPolicy,
} from './schedule-layout.ts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a UTC-midnight epoch‑ms value for a given date. */
function utcDate(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day)
}

const D1 = utcDate(2024, 5, 22) // 2024-05-22
const D2 = utcDate(2024, 5, 23) // 2024-05-23

/** Build a minimal AppointmentLayoutBlock with defaults (60‑min duration). */
function block(
  overrides: Partial<AppointmentLayoutBlock> & { id: number },
): AppointmentLayoutBlock {
  return {
    title: `Block ${overrides.id}`,
    user_id: 1,
    resource_id: 1,
    date: D1,
    start_min: 0,
    end_min: 60,
    ...overrides,
  }
}

/** Find a block by id in an array. */
function byId(blocks: AppointmentLayoutBlock[], id: number): AppointmentLayoutBlock | undefined {
  return blocks.find((b) => b.id === id)
}

// ---------------------------------------------------------------------------
// previewDeleteBlock
// ---------------------------------------------------------------------------

describe('previewDeleteBlock', () => {
  it('removes the block from the result blocks', () => {
    // Arrange
    let blocks = [
      block({ id: 1, start_min: 0, end_min: 60 }),
      block({ id: 2, start_min: 60, end_min: 120 }),
    ]

    // Act
    let result = previewDeleteBlock(blocks, 1)

    // Assert
    assert.equal(result.blocks.length, 1)
    assert.equal(result.blocks[0]!.id, 2)
  })

  it('returns blocks unchanged when block ID does not exist', () => {
    // Arrange
    let blocks = [block({ id: 1, start_min: 0, end_min: 60 })]

    // Act
    let result = previewDeleteBlock(blocks, 999)

    // Assert
    assert.equal(result.blocks.length, 1)
    assert.equal(result.blocks[0]!.id, 1)
    assert.equal(result.changes.length, 0)
  })

  it('includes a deleted change with a before snapshot of the removed block', () => {
    // Arrange
    let blocks = [block({ id: 1, title: 'Meeting', date: D1, start_min: 120, end_min: 180 })]

    // Act
    let result = previewDeleteBlock(blocks, 1)

    // Assert
    assert.equal(result.changes.length, 1)
    assert.equal(result.changes[0]!.kind, 'deleted')
    assert.equal(result.changes[0]!.id, 1)
    assert.ok(result.changes[0]!.before, 'should have a before snapshot')
    assert.equal(result.changes[0]!.before!.title, 'Meeting')
    assert.equal(result.changes[0]!.before!.start_min, 120)
  })

  it('does not alter other blocks positions', () => {
    // Arrange
    let blocks = [
      block({ id: 1, date: D1, start_min: 0, end_min: 60 }),
      block({ id: 2, date: D1, start_min: 120, end_min: 180 }),
      block({ id: 3, date: D2, start_min: 240, end_min: 300 }),
    ]

    // Act
    let result = previewDeleteBlock(blocks, 2)

    // Assert
    let b1 = byId(result.blocks, 1)!
    let b3 = byId(result.blocks, 3)!
    assert.equal(b1.start_min, 0)
    assert.equal(b1.end_min, 60)
    assert.equal(b3.start_min, 240)
    assert.equal(b3.end_min, 300)
  })

  it('returns empty array when deleting the last block', () => {
    // Arrange
    let blocks = [block({ id: 1, start_min: 0, end_min: 60 })]

    // Act
    let result = previewDeleteBlock(blocks, 1)

    // Assert
    assert.equal(result.blocks.length, 0)
  })

  it('has unresolved set to false', () => {
    // Arrange
    let blocks = [block({ id: 1, start_min: 0, end_min: 60 })]

    // Act
    let result = previewDeleteBlock(blocks, 1)

    // Assert
    assert.equal(result.unresolved, false)
  })

  it('does not mutate the original source blocks array', () => {
    // Arrange
    let blocks = [
      block({ id: 1, start_min: 0, end_min: 60 }),
      block({ id: 2, start_min: 60, end_min: 120 }),
    ]
    let originalLength = blocks.length

    // Act
    previewDeleteBlock(blocks, 1)

    // Assert
    assert.equal(blocks.length, originalLength)
  })

  it('returns empty result when source array is empty', () => {
    // Arrange
    let blocks: AppointmentLayoutBlock[] = []

    // Act
    let result = previewDeleteBlock(blocks, 1)

    // Assert
    assert.equal(result.blocks.length, 0)
    assert.equal(result.changes.length, 0)
    assert.equal(result.unresolved, false)
  })

  it('produces exactly one change entry for the deleted block', () => {
    // Arrange — three blocks, delete middle one
    let blocks = [
      block({ id: 1, start_min: 0, end_min: 60 }),
      block({ id: 2, start_min: 60, end_min: 120 }),
      block({ id: 3, start_min: 120, end_min: 180 }),
    ]

    // Act
    let result = previewDeleteBlock(blocks, 2)

    // Assert — only the deleted block generates a change entry
    assert.equal(result.changes.length, 1)
    assert.equal(result.changes[0]!.id, 2)
    assert.equal(result.changes[0]!.kind, 'deleted')
  })

  it('has no after snapshot on the deleted change', () => {
    // Arrange
    let blocks = [block({ id: 1, start_min: 0, end_min: 60 })]

    // Act
    let result = previewDeleteBlock(blocks, 1)

    // Assert — deletions only have before, never after
    assert.equal(result.changes.length, 1)
    assert.ok(result.changes[0]!.before, 'should have a before snapshot')
    assert.equal(result.changes[0]!.after, undefined, 'should not have an after snapshot')
  })

  it('preserves all original block fields in the before snapshot', () => {
    // Arrange — block with all fields specified
    let original = block({ id: 42, title: 'Sprint Review', date: D2, start_min: 180, end_min: 240 })

    // Act
    let result = previewDeleteBlock([original], 42)

    // Assert — before snapshot must contain every field from the original block
    assert.equal(result.changes.length, 1)
    let before = result.changes[0]!.before!
    assert.equal(before.id, 42)
    assert.equal(before.title, 'Sprint Review')
    assert.equal(before.date, D2)
    assert.equal(before.start_min, 180)
    assert.equal(before.end_min, 240)
  })
})

// ---------------------------------------------------------------------------
// previewMoveBlock
// ---------------------------------------------------------------------------

describe('previewMoveBlock', () => {
  it('moves a block to an empty time slot with no collisions', () => {
    // Arrange
    let blocks = [
      block({ id: 1, start_min: 0, end_min: 60 }),
      block({ id: 2, start_min: 120, end_min: 180 }),
    ]

    // Act
    let result = previewMoveBlock(blocks, 1, { date: D1, startMinute: 300 })

    // Assert
    let moved = byId(result.blocks, 1)!
    assert.equal(moved.start_min, 300)
    assert.equal(moved.end_min, 360)
    assert.equal(result.unresolved, false)
  })

  it('moves a block to overlap one existing block and resolves the collision', () => {
    // Arrange
    let blocks = [
      block({ id: 1, start_min: 0, end_min: 60 }),
      block({ id: 2, start_min: 60, end_min: 120 }),
    ]

    // Act — move block1 so it overlaps block2's slot
    let result = previewMoveBlock(blocks, 1, { date: D1, startMinute: 60 })

    // Assert — both blocks must be present and non‑overlapping
    assert.equal(result.blocks.length, 2)
    assert.equal(result.unresolved, false)

    let b1 = byId(result.blocks, 1)!
    let b2 = byId(result.blocks, 2)!
    assert.ok(b1.end_min <= b2.start_min || b2.end_min <= b1.start_min, 'blocks must not overlap')
  })

  it('moves a block to overlap multiple blocks and resolves all collisions', () => {
    // Arrange — fill the day so moving a block cascades
    let blocks = [
      block({ id: 1, start_min: 0, end_min: 60 }),
      block({ id: 2, start_min: 60, end_min: 120 }),
      block({ id: 3, start_min: 120, end_min: 180 }),
    ]

    // Act — move block1 to overlap block2's slot; solver should shift blocks
    let result = previewMoveBlock(blocks, 1, { date: D1, startMinute: 60 })

    // Assert — all three blocks present, no overlaps, valid layout
    assert.equal(result.blocks.length, 3)
    assert.equal(result.unresolved, false)

    for (let i = 0; i < result.blocks.length - 1; i++) {
      let left = result.blocks[i]!
      let right = result.blocks[i + 1]!
      assert.ok(
        left.date < right.date || (left.date === right.date && left.end_min <= right.start_min),
        `blocks ${left.id} and ${right.id} must not overlap`,
      )
    }
  })

  it('moves a block to a different day (cross‑day move)', () => {
    // Arrange
    let blocks = [
      block({ id: 1, date: D1, start_min: 0, end_min: 60 }),
      block({ id: 2, date: D2, start_min: 60, end_min: 120 }),
    ]

    // Act — move block from D1 to D2
    let result = previewMoveBlock(blocks, 1, { date: D2, startMinute: 120 })

    // Assert
    let moved = byId(result.blocks, 1)!
    assert.equal(moved.date, D2)
    assert.equal(moved.start_min, 120)
    assert.equal(moved.end_min, 180)
    assert.equal(result.unresolved, false)
  })

  it('swaps blocks between days when start_min matches (horizontal day swap)', () => {
    // Arrange — two blocks at the same time on different days
    let blocks = [
      block({ id: 1, date: D1, start_min: 120, end_min: 180 }),
      block({ id: 2, date: D2, start_min: 120, end_min: 180 }),
    ]

    // Act — move block 1 to D2 at the same start_min
    let result = previewMoveBlock(blocks, 1, { date: D2, startMinute: 120 })

    // Assert — block2 swapped to D1
    let b1 = byId(result.blocks, 1)!
    let b2 = byId(result.blocks, 2)!
    assert.equal(b1.date, D2)
    assert.equal(b2.date, D1)
    assert.equal(b1.start_min, 120)
    assert.equal(b2.start_min, 120)
  })

  it('returns unresolved true when no valid layout exists after move', () => {
    // Arrange — day packed full, no room to shift
    let blocks = [
      block({ id: 1, date: D1, start_min: 0, end_min: 60 }),
      block({ id: 2, date: D1, start_min: 60, end_min: 120 }),
      block({ id: 3, date: D2, start_min: 500, end_min: 560 }),
    ]

    // Act — try to move block3 to the full day with a compact policy
    let result = previewMoveBlock(blocks, 3, { date: D1, startMinute: 60 }, { dayMinutes: 120 })

    // Assert
    assert.equal(result.unresolved, true)
  })

  it('moves a block to minute 0 (midnight boundary)', () => {
    // Arrange
    let blocks = [block({ id: 1, date: D1, start_min: 120, end_min: 180 })]

    // Act
    let result = previewMoveBlock(blocks, 1, { date: D1, startMinute: 0 })

    // Assert
    let moved = byId(result.blocks, 1)!
    assert.equal(moved.start_min, 0)
    assert.equal(moved.end_min, 60)
  })

  it('moves a block to the end‑of‑day boundary', () => {
    // Arrange — 60‑min block placed at the last possible slot
    let blocks = [block({ id: 1, date: D1, start_min: 0, end_min: 60 })]

    // Act — last slot starts at dayMinutes - duration = 1380
    let result = previewMoveBlock(blocks, 1, { date: D1, startMinute: 1380 })

    // Assert
    let moved = byId(result.blocks, 1)!
    assert.equal(moved.start_min, 1380)
    assert.equal(moved.end_min, 1440)
  })

  it('clamps block start_min when movement would exceed the day boundary', () => {
    // Arrange — a 180‑min block
    let blocks = [block({ id: 1, date: D1, start_min: 0, end_min: 180 })]

    // Act — requesting start_min=1400, but 1400+180=1580 > 1440, clamped
    let result = previewMoveBlock(blocks, 1, { date: D1, startMinute: 1400 })

    // Assert — clamped to 1440 - 180 = 1260
    let moved = byId(result.blocks, 1)!
    assert.equal(moved.start_min, 1260)
    assert.equal(moved.end_min, 1440)
  })

  it('does not change the block id or title', () => {
    // Arrange
    let blocks = [block({ id: 42, title: 'Standup', date: D1, start_min: 0, end_min: 60 })]

    // Act
    let result = previewMoveBlock(blocks, 42, { date: D1, startMinute: 300 })

    // Assert
    let moved = byId(result.blocks, 42)!
    assert.equal(moved.id, 42)
    assert.equal(moved.title, 'Standup')
  })

  it('includes moved changes for all blocks that shifted', () => {
    // Arrange — force at least one block to shift
    let blocks = [
      block({ id: 1, start_min: 0, end_min: 60 }),
      block({ id: 2, start_min: 60, end_min: 120 }),
    ]

    // Act — moving block1 to block2's slot forces block2 to shift
    let result = previewMoveBlock(blocks, 1, { date: D1, startMinute: 60 })

    // Assert — at least one moved change exists
    let movedChanges = result.changes.filter((c) => c.kind === 'moved')
    assert.ok(movedChanges.length >= 1, 'should have at least one moved change')

    // The moved block (id=1) should appear as 'moved'
    let changeFor1 = result.changes.find((c) => c.id === 1)
    assert.ok(changeFor1, 'should track change for id 1')
    assert.equal(changeFor1!.kind, 'moved')
  })

  it('produces no changes when a block is moved to its current position', () => {
    // Arrange
    let blocks = [block({ id: 1, date: D1, start_min: 120, end_min: 180 })]

    // Act — same position
    let result = previewMoveBlock(blocks, 1, { date: D1, startMinute: 120 })

    // Assert
    assert.equal(result.changes.length, 0)
    assert.equal(result.blocks.length, 1)
  })

  it('snaps start_min to the nearest slot boundary', () => {
    // Arrange — slotMinutes = 15, so minutes snap to 15‑min boundaries
    let blocks = [block({ id: 1, date: D1, start_min: 0, end_min: 60 })]

    // Act — request a half‑hour offset (90 is already a 15‑min boundary)
    let result = previewMoveBlock(blocks, 1, { date: D1, startMinute: 90 })

    // Assert — 90 stays on 90 (nearest 15‑min boundary)
    let moved = byId(result.blocks, 1)!
    assert.equal(moved.start_min, 90)
    assert.equal(moved.end_min, 150)
  })

  it('sorts result blocks by date, start_min, then id', () => {
    // Arrange
    let blocks = [
      block({ id: 3, date: D1, start_min: 120, end_min: 180 }),
      block({ id: 1, date: D2, start_min: 60, end_min: 120 }),
      block({ id: 2, date: D1, start_min: 0, end_min: 60 }),
    ]

    // Act — move block1 to a new slot to trigger layout calculation
    let result = previewMoveBlock(blocks, 1, { date: D2, startMinute: 300 })

    // Assert — the sort order should hold across all blocks
    for (let i = 0; i < result.blocks.length - 1; i++) {
      let a = result.blocks[i]!
      let b = result.blocks[i + 1]!
      assert.ok(
        a.date < b.date ||
          (a.date === b.date && a.start_min < b.start_min) ||
          (a.date === b.date && a.start_min === b.start_min && a.id < b.id),
        `blocks should be sorted (failed at index ${i}: id ${a.id} vs ${b.id})`,
      )
    }
  })
})

// ---------------------------------------------------------------------------
// previewResizeBlockTime
// ---------------------------------------------------------------------------

describe('previewResizeBlockTime', () => {
  it('resizes the start edge earlier (dragging upward), increasing duration', () => {
    // Arrange — 3‑hour block at 180‑360
    let blocks = [block({ id: 1, date: D1, start_min: 180, end_min: 360 })]

    // Act — pull start edge back to minute 60
    let result = previewResizeBlockTime(blocks, 1, { edge: 'start', minute: 60 })

    // Assert
    let resized = byId(result.blocks, 1)!
    assert.equal(resized.start_min, 60)
    assert.equal(resized.end_min, 360)
    assert.equal(resized.end_min - resized.start_min, 300) // duration increased
  })

  it('resizes the start edge later (dragging downward), decreasing duration', () => {
    // Arrange — block from 60‑240 (180 min)
    let blocks = [block({ id: 1, date: D1, start_min: 60, end_min: 240 })]

    // Act — pull start forward to 180 (leaves 60 min minimum)
    let result = previewResizeBlockTime(blocks, 1, { edge: 'start', minute: 180 })

    // Assert
    let resized = byId(result.blocks, 1)!
    assert.equal(resized.start_min, 180)
    assert.equal(resized.end_min, 240)
    assert.equal(resized.end_min - resized.start_min, 60)
  })

  it('resizes the end edge later (dragging downward), increasing duration', () => {
    // Arrange — block from 60‑180 (120 min)
    let blocks = [block({ id: 1, date: D1, start_min: 60, end_min: 180 })]

    // Act — pull end edge to 300
    let result = previewResizeBlockTime(blocks, 1, { edge: 'end', minute: 300 })

    // Assert
    let resized = byId(result.blocks, 1)!
    assert.equal(resized.start_min, 60)
    assert.equal(resized.end_min, 300)
    assert.equal(resized.end_min - resized.start_min, 240)
  })

  it('resizes the end edge earlier (dragging upward), decreasing duration', () => {
    // Arrange — block from 60‑240 (180 min)
    let blocks = [block({ id: 1, date: D1, start_min: 60, end_min: 240 })]

    // Act — pull end back to 120
    let result = previewResizeBlockTime(blocks, 1, { edge: 'end', minute: 120 })

    // Assert
    let resized = byId(result.blocks, 1)!
    assert.equal(resized.start_min, 60)
    assert.equal(resized.end_min, 120)
    assert.equal(resized.end_min - resized.start_min, 60)
  })

  it('clamps resize to minimum duration when trying to go below it', () => {
    // Arrange — 60‑min block
    let blocks = [block({ id: 1, date: D1, start_min: 120, end_min: 180 })]

    // Act — try to shrink start edge past minimum (can't go past end_min - 15)
    let result = previewResizeBlockTime(blocks, 1, { edge: 'start', minute: 200 })

    // Assert — 200 snaps to 195, then clamped to 165 (end_min - 15)
    let resized = byId(result.blocks, 1)!
    assert.equal(resized.start_min, 165)
    assert.equal(resized.end_min, 180)
    assert.equal(resized.end_min - resized.start_min, 15)
  })

  it('clamps start edge when resizing past end_min - minimumDuration', () => {
    // Arrange — block from 60‑240 (180 min)
    let blocks = [block({ id: 1, date: D1, start_min: 60, end_min: 240 })]

    // Act — try to move start edge past the minimum duration boundary
    // max allowed start = 240 - 15 = 225; requesting 300 → snapped to 300, clamped to 225
    let result = previewResizeBlockTime(blocks, 1, { edge: 'start', minute: 300 })

    // Assert
    let resized = byId(result.blocks, 1)!
    assert.equal(resized.start_min, 225)
    assert.equal(resized.end_min, 240)
    assert.equal(resized.end_min - resized.start_min, 15)
  })

  it('clamps end edge to dayMinutes when moving past end of day', () => {
    // Arrange — block near end of day
    let blocks = [block({ id: 1, date: D1, start_min: 1320, end_min: 1380 })]

    // Act — extend past midnight
    let result = previewResizeBlockTime(blocks, 1, { edge: 'end', minute: 1500 })

    // Assert — clamped to dayMinutes (1440)
    let resized = byId(result.blocks, 1)!
    assert.equal(resized.start_min, 1320)
    assert.equal(resized.end_min, 1440)
  })

  it('shifts overlapping blocks when resize causes collision (push down)', () => {
    // Arrange — two adjacent blocks
    let blocks = [
      block({ id: 1, date: D1, start_min: 60, end_min: 120 }),
      block({ id: 2, date: D1, start_min: 120, end_min: 180 }),
    ]

    // Act — extend block1's end edge to overlap block2
    let result = previewResizeBlockTime(blocks, 1, { edge: 'end', minute: 150 })

    // Assert — block2 pushed down, no overlap
    assert.equal(result.unresolved, false)

    let b1 = byId(result.blocks, 1)!
    let b2 = byId(result.blocks, 2)!
    assert.ok(b1.end_min <= b2.start_min, 'block2 should be pushed after block1')
  })

  it('shifts overlapping blocks when resize causes collision (push up)', () => {
    // Arrange — block1 at 60-120 (not at minimumMinute, can be pushed up),
    // block2 at 180-240 — the block to resize
    let blocks = [
      block({ id: 1, date: D1, start_min: 60, end_min: 120 }),
      block({ id: 2, date: D1, start_min: 180, end_min: 240 }),
    ]

    // Act — resize block2's start edge to minute 90, overlapping block1
    let result = previewResizeBlockTime(blocks, 2, { edge: 'start', minute: 90 })

    // Assert — block1 should be pushed up (earlier) to avoid overlap
    assert.equal(result.unresolved, false)

    let b1 = byId(result.blocks, 1)!
    let b2 = byId(result.blocks, 2)!
    assert.ok(b1.end_min <= b2.start_min, 'blocks must not overlap after push up')
  })

  it('includes a resized change for the modified block', () => {
    // Arrange
    let blocks = [block({ id: 1, date: D1, start_min: 60, end_min: 180 })]

    // Act
    let result = previewResizeBlockTime(blocks, 1, { edge: 'end', minute: 300 })

    // Assert
    let change = result.changes.find((c) => c.id === 1)
    assert.ok(change, 'should have a change for block 1')
    assert.equal(change!.kind, 'resized')
    assert.ok(change!.before, 'should have before snapshot')
    assert.ok(change!.after, 'should have after snapshot')
    assert.equal(change!.before!.end_min, 180)
    assert.equal(change!.after!.end_min, 300)
  })

  it('snaps the resized edge to slot boundaries', () => {
    // Arrange — block from 120‑240
    let blocks = [block({ id: 1, date: D1, start_min: 120, end_min: 240 })]

    // Act — request start edge at minute 127 (should snap to 120 → no change)
    let result = previewResizeBlockTime(blocks, 1, { edge: 'start', minute: 127 })

    // Assert — 127 rounds down to 120 (nearest 15‑min boundary), so no change
    let resized = byId(result.blocks, 1)!
    assert.equal(resized.start_min, 120)
    assert.equal(resized.end_min, 240)
  })

  it('does not mutate the original source blocks', () => {
    // Arrange
    let blocks = [block({ id: 1, date: D1, start_min: 60, end_min: 180 })]
    let originalEnd = blocks[0]!.end_min

    // Act
    previewResizeBlockTime(blocks, 1, { edge: 'end', minute: 300 })

    // Assert — source unchanged
    assert.equal(blocks[0]!.end_min, originalEnd)
  })
})
