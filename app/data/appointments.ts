import { gte, lt, type Database } from 'remix/data-table'

import { appointments, type Appointment } from './schema.ts'
import { isDateInPast, isWithinHours } from '../utils/date-utils.ts'

interface AppointmentInput {
  title: string
  date: number
  start_min: number
  end_min: number
  resource_id: number
}

interface AppointmentUpdate {
  title?: string
  date?: number
  start_min?: number
  end_min?: number
  resource_id?: number
}

export class AppointmentError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export class AppointmentCollisionError extends AppointmentError {
  constructor() {
    super('Time slot already taken.', 409)
  }
}

class AppointmentPastDateError extends AppointmentError {
  constructor() {
    super('Termine in der Vergangenheit können nicht erstellt oder bearbeitet werden.', 422)
  }
}

class AppointmentPastDeleteError extends AppointmentError {
  constructor() {
    super('Termine können nur bis 24 Stunden vor Beginn gelöscht werden.', 403)
  }
}

export class AppointmentTooCloseError extends AppointmentError {
  constructor() {
    super('Termine können nur bis 24 Stunden vor Beginn bearbeitet werden.', 422)
  }
}

interface UpdateAppointmentOptions {
  /** Skip user_id scope check and 24h cancellation check (admin bypass). */
  adminBypass?: boolean
}

interface DeleteAppointmentOptions {
  /** Skip user_id scope check and 24h cancellation check (admin bypass). */
  adminBypass?: boolean
}

/** Minimum hours before appointment start for non-admin update/delete. */
const CANCELLATION_WINDOW_HOURS = 24

/**
 * Compute the appointment start time in epoch ms from its day-level date and start_min.
 */
function appointmentStartMs(date: number, startMin: number): number {
  return date + startMin * 60000
}

/** PostgreSQL exclusion violation error code */
const PG_EXCLUSION_VIOLATION = '23P01'

/**
 * Check if an error is a PostgreSQL exclusion constraint violation
 * (wrapped by the data-table adapter).
 */
export function isExclusionViolation(error: unknown): boolean {
  // The data-table wraps PostgreSQL errors in DataTableAdapterError,
  // with the original error in `.cause`
  let cause: unknown = error
  while (cause instanceof Error && 'cause' in cause && cause.cause != null) {
    cause = (cause as Error).cause
  }
  return (
    typeof cause === 'object' &&
    cause !== null &&
    'code' in cause &&
    (cause as { code: string }).code === PG_EXCLUSION_VIOLATION
  )
}

export async function listAppointmentsByWeek(
  db: Database,
  weekStart: number,
  weekEnd: number,
  resourceId?: number,
): Promise<Appointment[]> {
  let query = db
    .query(appointments)
    .where(gte('date', weekStart))
    .where(lt('date', weekEnd))

  if (resourceId !== undefined) {
    query = query.where({ resource_id: resourceId })
  }

  return await query.orderBy('date', 'asc').orderBy('start_min', 'asc').all()
}

export async function createAppointment(
  db: Database,
  userId: number,
  input: AppointmentInput,
): Promise<Appointment> {
  if (isDateInPast(input.date)) {
    throw new AppointmentPastDateError()
  }

  try {
    let result = await db.create(
      appointments,
      {
        user_id: userId,
        resource_id: input.resource_id,
        title: input.title.trim(),
        date: input.date,
        start_min: input.start_min,
        end_min: input.end_min,
      },
      { returnRow: true },
    )
    return result as Appointment
  } catch (error) {
    if (isExclusionViolation(error)) {
      throw new AppointmentCollisionError()
    }
    throw error
  }
}

export async function updateAppointment(
  db: Database,
  userId: number,
  appointmentId: number,
  input: AppointmentUpdate,
  options?: UpdateAppointmentOptions,
): Promise<Appointment> {
  let query: Record<string, unknown> = { id: appointmentId }
  if (!options?.adminBypass) {
    query.user_id = userId
  }
  let existing = await db.findOne(appointments, { where: query })
  if (!existing) {
    throw new AppointmentError('Appointment not found.', 404)
  }

  // Enforce 24h cancellation policy for non-admin users:
  // appointment can only be updated if its start time is at least 24h in the future.
  if (!options?.adminBypass) {
    let startMs = appointmentStartMs(Number(existing.date), existing.start_min as number)
    if (!isWithinHours(startMs, CANCELLATION_WINDOW_HOURS)) {
      throw new AppointmentTooCloseError()
    }
  }

  let update: Record<string, unknown> = {}
  if (input.title !== undefined) update.title = input.title.trim()
  if (input.date !== undefined) update.date = input.date
  if (input.start_min !== undefined) update.start_min = input.start_min
  if (input.end_min !== undefined) update.end_min = input.end_min
  if (input.resource_id !== undefined) update.resource_id = input.resource_id

  try {
    return await db.update(appointments, query as { id: number }, update)
  } catch (error) {
    if (isExclusionViolation(error)) {
      throw new AppointmentCollisionError()
    }
    throw error
  }
}

export async function deleteAppointment(
  db: Database,
  userId: number,
  appointmentId: number,
  options?: DeleteAppointmentOptions,
): Promise<void> {
  let query: Record<string, unknown> = { id: appointmentId }
  if (!options?.adminBypass) {
    query.user_id = userId
  }
  let existing = await db.findOne(appointments, { where: query })
  if (!existing) {
    throw new AppointmentError('Appointment not found.', 404)
  }

  // Enforce 24h cancellation policy for non-admin users:
  // appointment can only be deleted if its start time is at least 24h in the future.
  if (!options?.adminBypass) {
    let startMs = appointmentStartMs(Number(existing.date), existing.start_min as number)
    if (!isWithinHours(startMs, CANCELLATION_WINDOW_HOURS)) {
      throw new AppointmentPastDeleteError()
    }
  }

  let deleteQuery: Record<string, unknown> = { id: appointmentId }
  if (!options?.adminBypass) {
    deleteQuery.user_id = userId
  }
  await db.query(appointments).where(deleteQuery).delete()
}
