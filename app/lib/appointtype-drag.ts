export interface TypeDragState {
  active: boolean
  typeId: number
  title: string
}

let _typeDragState: TypeDragState | null = null
let _panelDropActive = false

export function getTypeDragState(): TypeDragState | null {
  return _typeDragState
}

export function setTypeDragState(state: TypeDragState | null): void {
  _typeDragState = state
}

export function getPanelDropActive(): boolean {
  return _panelDropActive
}

export function setPanelDropActive(active: boolean): void {
  _panelDropActive = active
}
