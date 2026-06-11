import { showToast } from './toast.ts'
import { readAppointmentData } from '../utils/appointment.ts'
import { COLLISION_STATUS, type AppData, type AppointmentLayoutBlock } from './appointment-grid-types.ts'

export function handleMutationResponse(response: Response): boolean {
  if (response.ok) {
    window.location.reload()
    return true
  }
  if (response.status === COLLISION_STATUS) {
    response
      .json()
      .then((body) => {
        showToast(body?.error || 'Time slot already taken.')
        window.location.reload()
      })
      .catch(() => {
        window.location.reload()
      })
    return true
  }
  if (response.status === 403) {
    response
      .json()
      .then((body) => {
        showToast(body?.error || 'Slot ist nicht buchbar.')
      })
      .catch((err) => console.warn('403 error parsing:', err))
    return true
  }
  if (response.status === 422) {
    response
      .json()
      .then((body) => {
        showToast(body?.error || 'Änderung konnte nicht gespeichert werden.')
      })
      .catch((err) => console.warn('422 error parsing:', err))
    return true
  }
  return false
}

export function handleBatchMutationResponses(results: PromiseSettledResult<Response>[]): void {
  let hasCollision = false
  let anyOk = false
  for (let r of results) {
    if (r.status === 'fulfilled') {
      if (r.value.ok) anyOk = true
      if (r.value.status === COLLISION_STATUS) hasCollision = true
    }
  }
  if (hasCollision) {
    showToast('Time slot already taken.')
  } else if (!anyOk) {
    showToast('Failed to save changes.')
  }
  window.location.reload()
}

export function readData(): AppData {
  let data = readAppointmentData()
  return {
    days: (data.days ?? []) as AppData['days'],
    appointments: (data.appointments ?? []) as AppData['appointments'],
    offerings: (data.offerings ?? []) as AppData['offerings'],
    csrfToken: (data.csrfToken as string) ?? '',
    weekStart: (data.weekStart as number) ?? 0,
    currentUserId: (data.currentUserId as number) ?? 0,
    selectedResourceId: (data.selectedResourceId as number) ?? 0,
    isAdmin: (data.isAdmin as boolean) ?? false,
    appointmentHref: (data.appointmentHref as string) ?? '',
    appointmentTypesHref: (data.appointmentTypesHref as string) ?? '',
  }
}

export function computeVisibleDays(
  days: AppData['days'],
  offerings: AppData['offerings'],
): AppData['days'] {
  return days.filter((d) => offerings.some((o) => o.day === d.date))
}

export function computeOfferingTimeRange(offerings: AppData['offerings']): {
  startMin: number
  endMin: number
} {
  if (offerings.length === 0) return { startMin: 0, endMin: 1440 }
  let startMin = Math.min(...offerings.map((o) => o.start_min))
  let endMin = Math.max(...offerings.map((o) => o.end_min))
  // Snap to 15-min boundaries
  startMin = Math.floor(startMin / 15) * 15
  endMin = Math.ceil(endMin / 15) * 15
  return { startMin, endMin }
}

export function computeBookableSlots(
  offerings: AppData['offerings'],
  visibleDays: AppData['days'],
  appointments?: AppointmentLayoutBlock[],
): { allBookableMinutes: number[]; bookableByDay: Map<number, Set<number>> } {
  let visibleDates = new Set(visibleDays.map((d) => d.date))
  let byDay = new Map<number, Set<number>>()
  let globalSet = new Set<number>()

  for (let o of offerings) {
    if (!visibleDates.has(o.day)) continue
    let daySet = byDay.get(o.day)
    if (!daySet) {
      daySet = new Set<number>()
      byDay.set(o.day, daySet)
    }
    for (let m = o.start_min; m < o.end_min; m += 15) {
      daySet.add(m)
      globalSet.add(m)
    }
  }

  // Remove 15-min slots that overlap with existing appointments
  if (appointments && appointments.length > 0) {
    for (let [day, daySet] of byDay) {
      let dayAppointments = appointments.filter((a) => a.date === day)
      if (dayAppointments.length === 0) continue
      for (let m of [...daySet]) {
        for (let appt of dayAppointments) {
          if (m < appt.end_min && m + 15 > appt.start_min) {
            daySet.delete(m)
            break
          }
        }
      }
    }
  }

  return {
    allBookableMinutes: [...globalSet].sort((a, b) => a - b),
    bookableByDay: byDay,
  }
}

export function copyAppt(block: AppointmentLayoutBlock): AppointmentLayoutBlock {
  return { ...block }
}
