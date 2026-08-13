import { DRAG_THRESHOLD, type AppData } from './appointment-grid-types.ts'

// ── Fixture data ──────────────────────────────────────────────────────

export function createFixtureData(overrides?: Partial<AppData>): AppData {
  let today = Date.UTC(2026, 6, 30) // Thursday
  let dayMs = 86_400_000

  return {
    days: [
      { dayName: 'Mon', date: today, dateStr: '30.07' },
      { dayName: 'Tue', date: today + dayMs, dateStr: '31.07' },
      { dayName: 'Wed', date: today + 2 * dayMs, dateStr: '01.08' },
    ],
    appointments: [
      {
        id: 1,
        date: today,
        start_min: 540, // 09:00
        end_min: 600, // 10:00
        title: 'Morning slot',
        resource_id: 1,
        user_id: 1,
      },
      {
        id: 2,
        date: today,
        start_min: 660, // 11:00
        end_min: 720, // 12:00
        title: 'Midday slot',
        resource_id: 1,
        user_id: 2,
      },
      {
        id: 3,
        date: today + dayMs,
        start_min: 540,
        end_min: 600,
        title: 'Tuesday slot',
        resource_id: 1,
        user_id: 1,
      },
    ],
    offerings: [
      { day: today, start_min: 480, end_min: 1080 }, // 08:00-18:00
      { day: today + dayMs, start_min: 480, end_min: 1080 },
      { day: today + 2 * dayMs, start_min: 480, end_min: 1080 },
    ],
    csrfToken: 'test-csrf-token',
    weekStart: today,
    currentUserId: 1,
    selectedResourceId: 1,
    isAdmin: true,
    appointmentHref: '/appointments',
    appointmentTypesHref: '/appointment-types',
    ...overrides,
  }
}

export function embedFixtureData(data: AppData): HTMLElement {
  let existing = document.getElementById('appointment-data')
  if (existing) existing.remove()

  let script = document.createElement('script')
  script.id = 'appointment-data'
  script.type = 'application/json'
  script.textContent = JSON.stringify(data)
  document.body.appendChild(script)
  return script
}

export function removeFixtureData() {
  let el = document.getElementById('appointment-data')
  if (el) el.remove()
}

// ── Pointer event helpers ──────────────────────────────────────────────

export function createPointerEvent(
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  opts: {
    clientX?: number
    clientY?: number
    pointerId?: number
    button?: number
    bubbles?: boolean
  } = {},
): PointerEvent {
  return new PointerEvent(type, {
    clientX: opts.clientX ?? 0,
    clientY: opts.clientY ?? 0,
    pointerId: opts.pointerId ?? 1,
    button: opts.button ?? 0,
    bubbles: opts.bubbles ?? true,
    cancelable: true,
    composed: true,
  })
}

export function dispatchDragSequence(
  target: HTMLElement,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
) {
  let pointerId = 1
  target.dispatchEvent(
    createPointerEvent('pointerdown', { clientX: startX, clientY: startY, pointerId }),
  )
  target.dispatchEvent(
    createPointerEvent('pointermove', { clientX: endX, clientY: endY, pointerId }),
  )
  target.dispatchEvent(createPointerEvent('pointerup', { clientX: endX, clientY: endY, pointerId }))
}

export function dispatchDragWithThreshold(
  target: HTMLElement,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  threshold: number = DRAG_THRESHOLD,
): { moved: boolean } {
  let dx = endX - startX
  let dy = endY - startY
  let distance = Math.sqrt(dx * dx + dy * dy)
  let pointerId = 1

  target.dispatchEvent(
    createPointerEvent('pointerdown', { clientX: startX, clientY: startY, pointerId }),
  )
  target.dispatchEvent(
    createPointerEvent('pointermove', { clientX: endX, clientY: endY, pointerId }),
  )

  let moved = distance > threshold
  if (moved) {
    target.dispatchEvent(
      createPointerEvent('pointerup', { clientX: endX, clientY: endY, pointerId }),
    )
  } else {
    target.dispatchEvent(
      createPointerEvent('pointerup', { clientX: startX, clientY: startY, pointerId }),
    )
  }
  return { moved }
}

// ── Fetch capture ──────────────────────────────────────────────────────

export type CapturedMutation = {
  method: string
  url: string
  body: FormData | string
}

let originalFetch: typeof window.fetch | null = null
let capturedMutations: CapturedMutation[] = []

export function installFetchCapture() {
  originalFetch = window.fetch
  capturedMutations = []
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    let method = (init?.method ?? 'GET').toUpperCase()

    if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
      capturedMutations.push({
        method,
        url,
        body: init?.body as FormData | string,
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export function uninstallFetchCapture() {
  if (originalFetch) {
    window.fetch = originalFetch
    originalFetch = null
  }
  capturedMutations = []
}

export function getCapturedMutations(): CapturedMutation[] {
  return capturedMutations
}

export function resetCapturedMutations() {
  capturedMutations = []
}

export function getCapturedMutationsByMethod(method: string): CapturedMutation[] {
  return capturedMutations.filter((m) => m.method === method.toUpperCase())
}

// ── Coordinate helpers ─────────────────────────────────────────────────

export function minuteToY(minute: number, offeringStartMin: number, rowHeight: number): number {
  return ((minute - offeringStartMin) / 15) * rowHeight
}

export function yToMinute(y: number, offeringStartMin: number, rowHeight: number): number {
  return Math.round(y / rowHeight) * 15 + offeringStartMin
}
