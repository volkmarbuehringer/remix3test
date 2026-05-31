import { type AppointmentLayoutBlock } from './schedule-layout.ts'

export type { AppointmentLayoutBlock }

export const HOURS = 24
export const SLOT_HEIGHT = 160
export const SUB_SLOTS = 4
export const SUB_SLOT_HEIGHT = SLOT_HEIGHT / SUB_SLOTS
export const LABEL_WIDTH = 44
export const DRAG_THRESHOLD = 4
export const COLLISION_STATUS = 409

export type GridMeasurement = {
  dayWidth: number
  labelWidth: number
  left: number
  rowHeight: number
  top: number
}

export type GestureKind = 'drag' | 'resize'

export type AppData = {
  days: Array<{ dayName: string; date: number; dateStr: string }>
  appointments: Array<AppointmentLayoutBlock>
  offerings: Array<{ day: number; start_min: number; end_min: number }>
  csrfToken: string
  weekStart: number
  currentUserId: number
  selectedResourceId: number
  isAdmin: boolean
}

export type DragState = {
  active: boolean
  blockId: number
  grid: GridMeasurement
  moved: boolean
  offsetX: number
  offsetY: number
  originalBlocks: AppointmentLayoutBlock[]
  placement: { date: number; startMinute: number }
  pointerId: number
  startX: number
  startY: number
}

export type ResizeState = {
  active: boolean
  blockId: number
  edge: 'start' | 'end'
  grid: GridMeasurement
  moved: boolean
  offsetY: number
  originalBlock: AppointmentLayoutBlock
  originalBlocks: AppointmentLayoutBlock[]
  pointerId: number
  startY: number
}
