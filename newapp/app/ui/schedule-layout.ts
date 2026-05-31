import { clamp } from '../lib/math.ts'

export interface AppointmentLayoutBlock {
  date: number
  end_min: number
  id: number
  resource_id: number
  start_min: number
  title: string
  user_id: number
  user_email?: string
}

export type ResizeEdge = 'start' | 'end'
type ReflowDirection = 'down' | 'up'

export interface LayoutPolicy {
  dayMinutes: number
  minimumMinute: number
  minimumDuration: number
  slotMinutes: number
}

type LayoutChangeKind = 'created' | 'deleted' | 'moved' | 'resized'

interface LayoutChange {
  after?: AppointmentLayoutBlock
  before?: AppointmentLayoutBlock
  id: number
  kind: LayoutChangeKind
}

export interface LayoutResult {
  blocks: AppointmentLayoutBlock[]
  changes: LayoutChange[]
  unresolved: boolean
}

interface BlockGroup {
  date: number
  end_min: number
  start_min: number
}

export const defaultLayoutPolicy: LayoutPolicy = {
  dayMinutes: 1440,
  minimumMinute: 0,
  minimumDuration: 15,
  slotMinutes: 15,
}

export function previewDeleteBlock(
  sourceBlocks: AppointmentLayoutBlock[],
  blockId: number,
): LayoutResult {
  let blocks = sourceBlocks.filter((block) => block.id !== blockId).map(copyBlock)
  return toResult(sourceBlocks, blocks, false)
}

export function previewMoveBlock(
  sourceBlocks: AppointmentLayoutBlock[],
  blockId: number,
  placement: { date: number; startMinute: number },
  policyInput: Partial<LayoutPolicy> = {},
): LayoutResult {
  let policy = createPolicy(policyInput)
  let originalBlocks = sourceBlocks.map(copyBlock)
  let movedBlock = requireBlock(originalBlocks, blockId)
  let originalBlock = copyBlock(movedBlock)
  let duration = durationOf(movedBlock)

  let blocks = originalBlocks.filter((block) => block.id !== blockId)
  let movedCopy = copyBlock(movedBlock)
  movedCopy.date = snapToMidnight(placement.date)
  movedCopy.start_min = clampMinute(
    placement.startMinute,
    policy.minimumMinute,
    policy.dayMinutes - duration,
    policy,
  )
  movedCopy.end_min = movedCopy.start_min + duration

  let swapped = previewHorizontalDaySwap(originalBlocks, movedCopy, originalBlock, policy)
  if (swapped) return toResult(sourceBlocks, swapped, false)

  let resolved = insertBlock(blocks, movedCopy, policy, originalBlock)
  return toResult(sourceBlocks, resolved ?? originalBlocks, resolved === null)
}

export function previewResizeBlockTime(
  sourceBlocks: AppointmentLayoutBlock[],
  blockId: number,
  resize: { edge: ResizeEdge; minute: number },
  policyInput: Partial<LayoutPolicy> = {},
): LayoutResult {
  let policy = createPolicy(policyInput)
  let originalBlocks = sourceBlocks.map(copyBlock)
  let blocks = originalBlocks.map(copyBlock)
  let resizedBlock = requireBlock(blocks, blockId)

  if (resize.edge === 'start') {
    resizedBlock.start_min = clampMinute(
      resize.minute,
      policy.minimumMinute,
      resizedBlock.end_min - policy.minimumDuration,
      policy,
    )
  } else {
    resizedBlock.end_min = clampMinute(
      resize.minute,
      resizedBlock.start_min + policy.minimumDuration,
      policy.dayMinutes,
      policy,
    )
  }

  let direction: ReflowDirection = resize.edge === 'start' ? 'up' : 'down'
  let resolved = resolvePush(blocks, resizedBlock, direction, policy)
  return toResult(sourceBlocks, resolved ?? originalBlocks, resolved === null)
}

function insertBlock(
  blocks: AppointmentLayoutBlock[],
  insertedBlock: AppointmentLayoutBlock,
  policy: LayoutPolicy,
  originalBlock: AppointmentLayoutBlock | null,
): AppointmentLayoutBlock[] | null {
  let withInserted = [...blocks.map(copyBlock), copyBlock(insertedBlock)]
  let inserted = requireBlock(withInserted, insertedBlock.id)
  if (!getCollisions(withInserted, inserted).length) {
    return isValidLayout(withInserted, policy) ? withInserted : null
  }

  let targetDayBlocks = blocks
    .filter((block) => block.date === inserted.date)
    .sort((left, right) => left.start_min - right.start_min)
  let otherBlocks = blocks.filter((block) => block.date !== inserted.date)
  let naturalIndex = insertionIndex(targetDayBlocks, inserted, originalBlock)
  let candidates: Array<{
    blocks: AppointmentLayoutBlock[]
    movedCount: number
    naturalDistance: number
    totalDistance: number
  }> = []

  for (let index = 0; index <= targetDayBlocks.length; index++) {
    let before = targetDayBlocks.slice(0, index)
    let after = targetDayBlocks.slice(index)
    let beforeLayout = layoutBeforeAnchor(before, inserted.start_min, policy)
    if (!beforeLayout) continue

    let afterLayout = layoutAfterAnchor(after, inserted.end_min, policy)
    if (!afterLayout) continue

    let candidate = [
      ...otherBlocks.map(copyBlock),
      ...beforeLayout,
      copyBlock(inserted),
      ...afterLayout,
    ]
    if (!isValidLayout(candidate, policy)) continue

    candidates.push({
      blocks: candidate,
      movedCount: countMoved([...beforeLayout, ...afterLayout], targetDayBlocks),
      naturalDistance: Math.abs(index - naturalIndex),
      totalDistance: totalMovement([...beforeLayout, ...afterLayout], targetDayBlocks),
    })
  }

  return (
    candidates.sort(
      (left, right) =>
        left.movedCount - right.movedCount ||
        left.totalDistance - right.totalDistance ||
        left.naturalDistance - right.naturalDistance,
    )[0]?.blocks ?? null
  )
}

function previewHorizontalDaySwap(
  originalBlocks: AppointmentLayoutBlock[],
  movedBlock: AppointmentLayoutBlock,
  originalBlock: AppointmentLayoutBlock,
  policy: LayoutPolicy,
): AppointmentLayoutBlock[] | null {
  if (movedBlock.date === originalBlock.date) return null
  if (movedBlock.start_min !== originalBlock.start_min) return null

  let displacedBlocks = originalBlocks.filter(
    (block) =>
      block.id !== movedBlock.id &&
      block.date === movedBlock.date &&
      blocksOverlap(block, movedBlock),
  )
  if (displacedBlocks.length !== 1) return null

  let displacedBlock = displacedBlocks[0]!
  let candidate = originalBlocks.map((block) => {
    if (block.id === movedBlock.id) return copyBlock(movedBlock)
    if (block.id !== displacedBlock.id) return copyBlock(block)

    let swappedBlock = copyBlock(block)
    swappedBlock.date = originalBlock.date
    return swappedBlock
  })

  return isValidLayout(candidate, policy) ? candidate : null
}

function insertionIndex(
  blocks: AppointmentLayoutBlock[],
  insertedBlock: AppointmentLayoutBlock,
  originalBlock: AppointmentLayoutBlock | null,
) {
  if (originalBlock?.date === insertedBlock.date) {
    let movingDown = insertedBlock.start_min > originalBlock.start_min
    let edge = movingDown ? insertedBlock.end_min : insertedBlock.start_min

    let index = blocks.findIndex((block) => edge <= blockCenter(block))
    return index === -1 ? blocks.length : index
  }

  let index = blocks.findIndex((block) => insertedBlock.start_min <= block.start_min)
  return index === -1 ? blocks.length : index
}

function layoutBeforeAnchor(
  blocks: AppointmentLayoutBlock[],
  anchorStartMinute: number,
  policy: LayoutPolicy,
) {
  let placed: AppointmentLayoutBlock[] = []
  let cursor = anchorStartMinute

  for (let block of [...blocks].reverse()) {
    let nextBlock = copyBlock(block)
    let latestStart = cursor - durationOf(nextBlock)
    let startMinute = Math.min(nextBlock.start_min, latestStart)
    if (startMinute < policy.minimumMinute) return null

    moveBlockTo(nextBlock, startMinute)
    placed.unshift(nextBlock)
    cursor = nextBlock.start_min
  }

  return placed
}

function layoutAfterAnchor(
  blocks: AppointmentLayoutBlock[],
  anchorEndMinute: number,
  policy: LayoutPolicy,
) {
  let placed: AppointmentLayoutBlock[] = []
  let cursor = anchorEndMinute

  for (let block of blocks) {
    let nextBlock = copyBlock(block)
    let startMinute = Math.max(nextBlock.start_min, cursor)
    if (startMinute + durationOf(nextBlock) > policy.dayMinutes) return null

    moveBlockTo(nextBlock, startMinute)
    placed.push(nextBlock)
    cursor = nextBlock.end_min
  }

  return placed
}

function countMoved(placedBlocks: AppointmentLayoutBlock[], originalBlocks: AppointmentLayoutBlock[]) {
  let originalById = new Map(originalBlocks.map((block) => [block.id, block]))
  return placedBlocks.filter((block) => {
    let original = originalById.get(block.id)
    return original && original.start_min !== block.start_min
  }).length
}

function totalMovement(placedBlocks: AppointmentLayoutBlock[], originalBlocks: AppointmentLayoutBlock[]) {
  let originalById = new Map(originalBlocks.map((block) => [block.id, block]))
  return placedBlocks.reduce((total, block) => {
    let original = originalById.get(block.id)
    return total + (original ? Math.abs(original.start_min - block.start_min) : 0)
  }, 0)
}

function resolvePush(
  blocks: AppointmentLayoutBlock[],
  anchorBlock: AppointmentLayoutBlock,
  direction: ReflowDirection,
  policy: LayoutPolicy,
) {
  let candidate = blocks.map(copyBlock)
  let anchor = requireBlock(candidate, anchorBlock.id)
  let collisions = getCollisions(candidate, anchor)
  if (collisions.length === 0) return isValidLayout(candidate, policy) ? candidate : null

  let dayBlocks = candidate.filter(
    (block) => block.id !== anchor.id && block.date === anchor.date,
  )

  if (direction === 'down') {
    placeBlocksDown(anchor, dayBlocks)
  } else {
    placeBlocksUp(anchor, dayBlocks)
  }

  return isValidLayout(candidate, policy) ? candidate : null
}

function placeBlocksDown(anchorBlock: AppointmentLayoutBlock, dayBlocks: AppointmentLayoutBlock[]) {
  let cursor = anchorBlock.end_min

  for (let block of dayBlocks.sort((left, right) => left.start_min - right.start_min)) {
    if (block.end_min <= anchorBlock.start_min) continue
    if (block.start_min < cursor) {
      moveBlockTo(block, cursor)
      cursor = block.end_min
    }
  }
}

function placeBlocksUp(anchorBlock: AppointmentLayoutBlock, dayBlocks: AppointmentLayoutBlock[]) {
  let cursor = anchorBlock.start_min

  for (let block of dayBlocks.sort((left, right) => right.start_min - left.start_min)) {
    if (block.start_min >= anchorBlock.end_min) continue
    if (block.end_min > cursor) {
      moveBlockTo(block, cursor - durationOf(block))
      cursor = block.start_min
    }
  }
}

function toResult(
  beforeBlocks: AppointmentLayoutBlock[],
  afterBlocks: AppointmentLayoutBlock[],
  unresolved: boolean,
): LayoutResult {
  let blocks = sortBlocks(afterBlocks)
  return {
    blocks,
    changes: getChanges(beforeBlocks, blocks),
    unresolved,
  }
}

function getChanges(beforeBlocks: AppointmentLayoutBlock[], afterBlocks: AppointmentLayoutBlock[]) {
  let beforeById = new Map(beforeBlocks.map((block) => [block.id, block]))
  let afterById = new Map(afterBlocks.map((block) => [block.id, block]))
  let changes: LayoutChange[] = []

  for (let before of beforeBlocks) {
    let after = afterById.get(before.id)
    if (!after) {
      changes.push({ before: copyBlock(before), id: before.id, kind: 'deleted' })
      continue
    }

    if (sameBlockPlacement(before, after)) continue

    changes.push({
      after: copyBlock(after),
      before: copyBlock(before),
      id: before.id,
      kind: durationOf(before) === durationOf(after) ? 'moved' : 'resized',
    })
  }

  for (let after of afterBlocks) {
    if (beforeById.has(after.id)) continue
    changes.push({ after: copyBlock(after), id: after.id, kind: 'created' })
  }

  return changes
}

function getCollisions(blocks: AppointmentLayoutBlock[], anchorBlock: AppointmentLayoutBlock) {
  return blocks.filter(
    (block) =>
      block.id !== anchorBlock.id &&
      block.date === anchorBlock.date &&
      block.resource_id === anchorBlock.resource_id &&
      blocksOverlap(block, anchorBlock),
  )
}

function isValidLayout(blocks: AppointmentLayoutBlock[], policy: LayoutPolicy) {
  return blocks.every((block) => isValidBlock(block, policy)) && isNonOverlapping(blocks)
}

function isValidBlock(block: AppointmentLayoutBlock, policy: LayoutPolicy) {
  return (
    block.date > 0 &&
    Number.isInteger(block.start_min) &&
    Number.isInteger(block.end_min) &&
    block.start_min >= policy.minimumMinute &&
    block.end_min <= policy.dayMinutes &&
    durationOf(block) >= policy.minimumDuration
  )
}

function isNonOverlapping(blocks: AppointmentLayoutBlock[]) {
  let byDate = new Map<number, AppointmentLayoutBlock[]>()

  for (let block of blocks) {
    let dayBlocks = byDate.get(block.date) ?? []
    dayBlocks.push(block)
    byDate.set(block.date, dayBlocks)
  }

  for (let dayBlocks of byDate.values()) {
    let sorted = dayBlocks.sort((left, right) => left.start_min - right.start_min)
    for (let index = 0; index < sorted.length - 1; index++) {
      if (blocksOverlap(sorted[index]!, sorted[index + 1]!)) return false
    }
  }

  return true
}

function sameBlockPlacement(left: AppointmentLayoutBlock, right: AppointmentLayoutBlock) {
  return (
    left.date === right.date &&
    left.end_min === right.end_min &&
    left.title === right.title &&
    left.start_min === right.start_min
  )
}

function blocksOverlap(left: AppointmentLayoutBlock, right: AppointmentLayoutBlock) {
  return left.start_min < right.end_min && left.end_min > right.start_min
}

function moveBlockTo(block: AppointmentLayoutBlock, startMinute: number) {
  let duration = durationOf(block)
  block.start_min = startMinute
  block.end_min = startMinute + duration
}

function blockCenter(block: AppointmentLayoutBlock) {
  return block.start_min + durationOf(block) / 2
}

function durationOf(block: AppointmentLayoutBlock) {
  return block.end_min - block.start_min
}

function requireBlock(blocks: AppointmentLayoutBlock[], blockId: number) {
  let block = blocks.find((block) => block.id === blockId)
  if (!block) throw new Error(`Unknown appointment block: ${blockId}`)
  return block
}

function sortBlocks(blocks: AppointmentLayoutBlock[]) {
  return blocks
    .map(copyBlock)
    .sort(
      (left, right) =>
        left.date - right.date ||
        left.start_min - right.start_min ||
        left.id - right.id,
    )
}

function copyBlock(block: AppointmentLayoutBlock): AppointmentLayoutBlock {
  return { ...block }
}

function createPolicy(policy: Partial<LayoutPolicy>) {
  return { ...defaultLayoutPolicy, ...policy }
}

function snapToMidnight(epochMs: number): number {
  let d = new Date(epochMs)
  d.setUTCHours(0, 0, 0, 0)
  return d.getTime()
}

function clampMinute(value: number, min: number, max: number, policy: LayoutPolicy) {
  let snapped = Math.round(value / policy.slotMinutes) * policy.slotMinutes
  return clamp(snapped, min, Math.max(min, max))
}
