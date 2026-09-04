import { describe, it, before, after } from 'remix/test'
import * as assert from 'remix/assert'
import {
  computeVisibleDays,
  computeOfferingTimeRange,
  computeBookableSlots,
  copyAppt,
  handleMutationResponse,
  handleBatchMutationResponses,
  readData,
} from './appointment-grid-lib.ts'
import type { AppointmentLayoutBlock } from './appointment-grid-types.ts'

function utcDate(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day)
}

function day(date: number, dayName?: string) {
  return { dayName: dayName ?? 'Mo', date, dateStr: new Date(date).toISOString().split('T')[0]! }
}

function offering(day: number, start_min: number, end_min: number) {
  return { day, start_min, end_min }
}

const MON = utcDate(2026, 6, 8)
const TUE = utcDate(2026, 6, 9)
const WED = utcDate(2026, 6, 10)

describe('computeVisibleDays', () => {
  it('returns only days that have matching offerings', () => {
    let days = [day(MON), day(TUE), day(WED)]
    let offerings = [offering(MON, 480, 540), offering(WED, 600, 660)]
    let result = computeVisibleDays(days, offerings)
    assert.equal(result.length, 2)
    assert.equal(result[0]!.date, MON)
    assert.equal(result[1]!.date, WED)
  })

  it('returns empty array when no days match', () => {
    let result = computeVisibleDays([day(MON)], [offering(TUE, 0, 60)])
    assert.equal(result.length, 0)
  })

  it('returns empty array when no offerings exist', () => {
    let result = computeVisibleDays([day(MON)], [])
    assert.equal(result.length, 0)
  })

  it('returns empty array when no days exist', () => {
    let result = computeVisibleDays([], [offering(MON, 0, 60)])
    assert.equal(result.length, 0)
  })
})

describe('computeOfferingTimeRange', () => {
  it('returns min/max of offering start_min/end_min snapped to 15-min boundaries', () => {
    let result = computeOfferingTimeRange([offering(MON, 480, 540), offering(TUE, 600, 720)])
    assert.equal(result.startMin, 480)
    assert.equal(result.endMin, 720)
  })

  it('snaps start_min down to previous 15-min boundary', () => {
    let result = computeOfferingTimeRange([offering(MON, 482, 540)])
    assert.equal(result.startMin, 480)
  })

  it('snaps end_min up to next 15-min boundary', () => {
    let result = computeOfferingTimeRange([offering(MON, 480, 541)])
    assert.equal(result.endMin, 555)
  })

  it('returns {0, 1440} for empty offerings', () => {
    let result = computeOfferingTimeRange([])
    assert.equal(result.startMin, 0)
    assert.equal(result.endMin, 1440)
  })

  it('handles single offering', () => {
    let result = computeOfferingTimeRange([offering(MON, 120, 180)])
    assert.equal(result.startMin, 120)
    assert.equal(result.endMin, 180)
  })
})

describe('computeBookableSlots', () => {
  it('returns 15-min slots from offerings for visible days', () => {
    let offerings = [offering(MON, 480, 510)]
    let visibleDays = [day(MON)]
    let result = computeBookableSlots(offerings, visibleDays)
    assert.equal(result.allBookableMinutes.length, 2)
    assert.equal(result.allBookableMinutes[0], 480)
    assert.equal(result.allBookableMinutes[1], 495)
    assert.ok(result.bookableByDay.has(MON))
    assert.equal(result.bookableByDay.get(MON)!.size, 2)
  })

  it('excludes days not in visibleDays', () => {
    let offerings = [offering(MON, 480, 510), offering(TUE, 600, 615)]
    let visibleDays = [day(MON)]
    let result = computeBookableSlots(offerings, visibleDays)
    assert.ok(result.bookableByDay.has(MON))
    assert.ok(!result.bookableByDay.has(TUE))
  })

  it('removes slots overlapping with existing appointments', () => {
    let offerings = [offering(MON, 480, 540)]
    let visibleDays = [day(MON)]
    let appointments: AppointmentLayoutBlock[] = [
      {
        id: 1,
        title: 'Test',
        user_id: 1,
        resource_id: 1,
        date: MON,
        start_min: 490,
        end_min: 510,
      },
    ]
    let result = computeBookableSlots(offerings, visibleDays, appointments)
    let daySet = result.bookableByDay.get(MON)!
    assert.ok(!daySet.has(480), 'slot 480 overlaps with appt (480-495 crosses 490)')
    assert.ok(!daySet.has(495), 'slot 495 overlaps with appt (495-510 crosses 490-510)')
    assert.ok(daySet.has(510), 'slot 510 should be bookable (510 < 510 is false)')
    assert.ok(daySet.has(525), 'slot 525 should be bookable')
  })

  it('returns empty when no offerings match visible days', () => {
    let result = computeBookableSlots([offering(MON, 480, 510)], [day(TUE)])
    assert.equal(result.allBookableMinutes.length, 0)
    assert.equal(result.bookableByDay.size, 0)
  })

  it('handles empty offerings', () => {
    let result = computeBookableSlots([], [day(MON)])
    assert.equal(result.allBookableMinutes.length, 0)
  })

  it('handles empty appointments gracefully', () => {
    let offerings = [offering(MON, 480, 510)]
    let result = computeBookableSlots(offerings, [day(MON)], [])
    assert.equal(result.allBookableMinutes.length, 2)
  })
})

describe('copyAppt', () => {
  it('returns a shallow copy of the block', () => {
    let block: AppointmentLayoutBlock = {
      id: 1,
      title: 'Test',
      user_id: 1,
      resource_id: 1,
      date: MON,
      start_min: 480,
      end_min: 540,
    }
    let copy = copyAppt(block)
    assert.notEqual(copy, block)
    assert.equal(copy.id, block.id)
    assert.equal(copy.title, block.title)
    assert.equal(copy.start_min, block.start_min)
  })
})

function setupWindowMock() {
  let mockLocation = { reload: () => {} } as Location
  globalThis.window = { location: mockLocation } as unknown as Window & typeof globalThis
  Object.defineProperty(globalThis, 'location', { value: mockLocation, writable: true })
}

function setupDomMock() {
  let el = {
    style: {} as Record<string, string>,
    remove: () => {},
    textContent: '',
    appendChild: () => {},
  }
  globalThis.document = {
    getElementById: () => null as HTMLElement | null,
    createElement: () => el,
    body: { appendChild: () => {} },
  } as unknown as Document
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
    cb(0)
    return 0
  }
}

function cleanupGlobals() {
  delete (globalThis as unknown as { window?: unknown }).window
  delete (globalThis as unknown as { document?: unknown }).document
  delete (globalThis as unknown as { requestAnimationFrame?: unknown }).requestAnimationFrame
}

describe('handleMutationResponse', () => {
  before(setupWindowMock)
  after(cleanupGlobals)

  it('returns true and reloads for ok response', () => {
    let response = new Response(null, { status: 200 })
    assert.ok(handleMutationResponse(response))
  })

  it('returns true and reloads for 201 response', () => {
    let response = new Response(null, { status: 201 })
    assert.ok(handleMutationResponse(response))
  })

  it('returns true and shows toast for 409 collision', async () => {
    setupDomMock()
    let response = new Response(JSON.stringify({ error: 'Time conflict' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    })
    assert.ok(handleMutationResponse(response))
  })

  it('returns true for 403 without error body', () => {
    setupDomMock()
    let response = new Response(null, {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
    assert.ok(handleMutationResponse(response))
  })

  it('returns true for 422 without error body', () => {
    setupDomMock()
    let response = new Response(null, {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    })
    assert.ok(handleMutationResponse(response))
  })

  it('returns false for unknown status', () => {
    let response = new Response(null, { status: 500 })
    assert.ok(!handleMutationResponse(response))
  })
})

describe('handleBatchMutationResponses', () => {
  before(() => {
    setupWindowMock()
    setupDomMock()
  })
  after(cleanupGlobals)

  it('reloads when all responses are ok', () => {
    let results: PromiseSettledResult<Response>[] = [
      { status: 'fulfilled', value: new Response(null, { status: 200 }) },
      { status: 'fulfilled', value: new Response(null, { status: 201 }) },
    ]
    handleBatchMutationResponses(results)
  })

  it('reloads when there is a collision', () => {
    let results: PromiseSettledResult<Response>[] = [
      { status: 'fulfilled', value: new Response(null, { status: 409 }) },
    ]
    handleBatchMutationResponses(results)
  })

  it('reloads even when no response is ok', () => {
    let results: PromiseSettledResult<Response>[] = [
      { status: 'fulfilled', value: new Response(null, { status: 500 }) },
    ]
    handleBatchMutationResponses(results)
  })

  it('handles rejected promises gracefully', () => {
    let results: PromiseSettledResult<Response>[] = [
      { status: 'rejected', reason: new Error('Network error') },
    ]
    handleBatchMutationResponses(results)
  })
})

describe('readData', () => {
  before(() => {
    globalThis.document = {
      getElementById: () => ({
        textContent: JSON.stringify({
          days: [{ dayName: 'Mo', date: MON, dateStr: '2026-06-08' }],
          appointments: [],
          offerings: [],
          csrfToken: 'abc123',
          weekStart: MON,
          currentUserId: 1,
          selectedResourceId: 2,
          isAdmin: false,
          appointmentHref: '/appointment',
          appointmentTypesHref: '/appointment/types',
        }),
      }),
    } as unknown as Document
  })

  after(() => {
    delete (globalThis as unknown as { document?: unknown }).document
  })

  it('reads and parses embedded appointment data', () => {
    let data = readData()
    assert.equal(data.days.length, 1)
    assert.equal(data.days[0]!.date, MON)
    assert.equal(data.csrfToken, 'abc123')
    assert.equal(data.weekStart, MON)
    assert.equal(data.currentUserId, 1)
    assert.equal(data.selectedResourceId, 2)
    assert.equal(data.isAdmin, false)
    assert.equal(data.appointmentHref, '/appointment')
    assert.equal(data.appointmentTypesHref, '/appointment/types')
  })

  it('returns defaults for missing fields', () => {
    globalThis.document = {
      getElementById: () => ({
        textContent: JSON.stringify({}),
      }),
    } as unknown as Document

    let data = readData()
    assert.equal(data.days.length, 0)
    assert.equal(data.csrfToken, '')
    assert.equal(data.weekStart, 0)
    assert.equal(data.currentUserId, 0)
    assert.equal(data.selectedResourceId, 0)
    assert.equal(data.isAdmin, false)
  })

  it('returns defaults when script tag is missing', () => {
    globalThis.document = {
      getElementById: () => null,
    } as unknown as Document

    let data = readData()
    assert.equal(data.days.length, 0)
    assert.equal(data.csrfToken, '')
  })
})
