import { createController } from 'remix/router'
import * as s from 'remix/data-schema'
import { max, maxLength, min, minLength } from 'remix/data-schema/checks'
import { getCsrfToken } from 'remix/middleware/csrf'
import { getCspNonce } from '../../middleware/security-headers.ts'

import {
  listAppointmentsByWeek,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  AppointmentError,
  AppointmentCollisionError,
  AppointmentTooCloseError,
  isExclusionViolation,
} from '../../data/appointments.ts'
import {
  listAppointTypes,
  createAppointType,
  updateAppointType,
  deleteAppointType,
  AppointTypeError,
} from '../../data/appointtypes.ts'
import { listOfferingsByWeek, isSlotBookable } from '../../data/appointofferings.ts'
import { isDateInPast } from '../../utils/date-utils.ts'
import { listResources } from '../../data/resources.ts'
import { pool } from '../../data/setup.ts'
import { appointments } from '../../data/schema.ts'
import type { User } from '../../data/schema.ts'
import { AppointmentPage } from '../../ui/appointment-page.tsx'
import { AppointTypePanel } from '../../ui/appointtype-panel.tsx'
import { appointmentChannel } from '../../lib/appointments-sse.ts'
import { createRateLimiter } from '../../utils/rate-limiter.ts'
import { issuesToFieldErrors } from '../../utils/schema-utils.ts'
import { requireAuth } from '../../middleware/auth.ts'
import { fragmentResponseInit } from '../../middleware/render.tsx'
import { routes } from '../../routes.ts'

const MINUTES_IN_DAY = 1440
const MINIMUM_DURATION = 15

// ── Appointment ──

const RATE_LIMIT_MS = process.env.APPOINTMENT_RATE_LIMIT_MS !== undefined
  ? Number(process.env.APPOINTMENT_RATE_LIMIT_MS)
  : 1000
const appointmentCreateLimiter = createRateLimiter({ windowMs: RATE_LIMIT_MS, perUser: true })
const appointmentUpdateLimiter = createRateLimiter({ windowMs: RATE_LIMIT_MS, perUser: true })
const appointmentDeleteLimiter = createRateLimiter({ windowMs: RATE_LIMIT_MS, perUser: true })

const appointmentCreateSchema = s.object({
  title: s.string().pipe(minLength(1), maxLength(80)),
  date: s.number(),
  start_min: s.number().pipe(min(0), max(MINUTES_IN_DAY)),
  end_min: s.number().pipe(min(0), max(MINUTES_IN_DAY)),
  resource_id: s.number(),
})

const appointmentUpdateSchema = s.object({
  title: s.optional(s.string().pipe(minLength(1), maxLength(80))),
  date: s.optional(s.number()),
  start_min: s.optional(s.number().pipe(min(0), max(MINUTES_IN_DAY))),
  end_min: s.optional(s.number().pipe(min(0), max(MINUTES_IN_DAY))),
  resource_id: s.optional(s.number()),
})

function getMondayOfWeek(year: number, week: number): number {
  let jan4 = new Date(Date.UTC(year, 0, 4))
  let dayOfWeek = jan4.getUTCDay() || 7
  let jan4Monday = jan4.getTime() - (dayOfWeek - 1) * 86_400_000
  return jan4Monday + (week - 1) * 7 * 86_400_000
}

function getWeekNumber(date: Date): { year: number; week: number } {
  let target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  let dayOfWeek = target.getUTCDay() || 7
  target.setUTCDate(target.getUTCDate() + 4 - dayOfWeek)
  let yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))
  let week = Math.ceil(((target.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return { year: target.getUTCFullYear(), week }
}

function clampYear(year: number): number {
  if (year < 2026) return 2026
  if (year > 2030) return 2030
  return year
}

function isoWeeksInYear(year: number): number {
  let jan1 = new Date(Date.UTC(year, 0, 1))
  let day = jan1.getUTCDay() || 7
  let isLeap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  return day === 4 || (isLeap && day === 3) ? 53 : 52
}

function clampWeek(week: number, year?: number): number {
  if (week < 1) return 1
  let max = year !== undefined ? isoWeeksInYear(year) : 53
  if (week > max) return max
  return week
}

const DAY_NAMES = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'] as const

function weekDates(mondayMs: number): Array<{ dayName: string; date: number; dateStr: string }> {
  let days: Array<{ dayName: string; date: number; dateStr: string }> = []
  for (let i = 0; i < 7; i++) {
    let ms = mondayMs + i * 86_400_000
    let d = new Date(ms)
    days.push({
      dayName: DAY_NAMES[i],
      date: ms,
      dateStr: `${d.getUTCDate()}.${d.getUTCMonth() + 1}.`,
    })
  }
  return days
}

export const appointment = createController(routes.appointment, {
  middleware: [requireAuth()],

  actions: {
    async index(context) {
      let auth = context.auth
      if (!auth?.ok) {
        return Response.redirect(new URL(routes.auth.login.index.href(), context.request.url), 302)
      }
      let currentUser = auth.identity as User
      let currentUserId = currentUser.id
      let isAdmin = currentUser.role === 'admin'

      let now = new Date()
      let current = getWeekNumber(now)
      let yearParam = context.url.searchParams.get('year')
      let weekParam = context.url.searchParams.get('week')
      let resourceIdParam = context.url.searchParams.get('resource_id')

      let parsedYear = yearParam ? parseInt(yearParam, 10) : NaN
      let parsedWeek = weekParam ? parseInt(weekParam, 10) : NaN
      let parsedResourceId = resourceIdParam ? parseInt(resourceIdParam, 10) : NaN

      let selectedYear = Number.isNaN(parsedYear) ? clampYear(current.year) : clampYear(parsedYear)
      let selectedWeek = Number.isNaN(parsedWeek) ? clampWeek(current.week) : clampWeek(parsedWeek, selectedYear)

      let mondayMs = getMondayOfWeek(selectedYear, selectedWeek)
      let nextMondayMs = mondayMs + 7 * 86_400_000
      let days = weekDates(mondayMs)

      let allResources = await listResources(context.db)
      let selectedResourceId = Number.isNaN(parsedResourceId) ? (allResources[0]?.id ?? 0) : parsedResourceId
      let appts = await listAppointmentsByWeek(context.db, mondayMs, nextMondayMs, selectedResourceId)

      if (isAdmin && appts.length > 0) {
        let userIds = [...new Set(appts.map((a) => a.user_id))]
        let result = await pool.query(
          'SELECT id, email FROM users WHERE id = ANY($1::int[])',
          [userIds],
        )
        let emailMap = new Map(
          (result.rows as Array<{ id: number; email: string }>).map((r) => [r.id, r.email]),
        )
        for (let appt of appts as Array<Record<string, unknown>>) {
          appt.user_email = emailMap.get(appt.user_id as number) ?? ''
        }
      }

      let offerings = await listOfferingsByWeek(context.db, mondayMs, nextMondayMs, selectedResourceId)

      return context.render(
        <AppointmentPage
          year={selectedYear}
          week={selectedWeek}
          days={days}
          appointments={appts}
          offerings={offerings}
          resources={allResources}
          selectedResourceId={selectedResourceId}
          csrfToken={getCsrfToken(context)}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
        />,
      )
    },

    async create(context) {
      let auth = context.auth
      if (!auth?.ok) {
        return context.json({ error: 'Authentication required.' }, { status: 401 })
      }
      let userId = (auth.identity as User).id

      if (!appointmentCreateLimiter.attempt(userId)) {
        return context.json({ error: 'Too many requests. Please wait before creating another appointment.' }, { status: 429 })
      }

      let body: Record<string, unknown>
      try {
        body = await context.request.json()
      } catch {
        return context.json({ error: 'Expected a valid JSON request body.' }, { status: 400 })
      }

      if (typeof body.typeId === 'number') {
        if (typeof body.date !== 'number' || typeof body.start_min !== 'number') {
          return context.json({ error: 'date and start_min are required with typeId.' }, { status: 400 })
        }
        if (typeof body.resource_id !== 'number') {
          return context.json({ error: 'resource_id is required.' }, { status: 400 })
        }

        if (isDateInPast(body.date)) {
          return context.json({ error: 'Termine in der Vergangenheit können nicht erstellt oder bearbeitet werden.' }, { status: 422 })
        }

        let bookable = await isSlotBookable(context.db, body.date, body.resource_id, body.start_min, body.start_min + 15)
        if (!bookable) {
          return context.json({ error: 'Slot is not bookable.' }, { status: 403 })
        }

        let now = Date.now()
        try {
          let result = await pool.query(
            `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
             SELECT user_id, $6, title, $1::bigint, int4range($2::integer, $2::integer + 15, '[)'), $3, $3
             FROM appointtypes
             WHERE id = $4 AND user_id = $5
             RETURNING id`,
            [body.date, body.start_min, now, body.typeId, userId, body.resource_id],
          )

          if (result.rows.length === 0) {
            return context.json({ error: 'Appointment type not found or access denied.' }, { status: 404 })
          }

          appointmentChannel.broadcast('invalidate')
          return context.json({ id: result.rows[0].id }, { status: 201 })
        } catch (error) {
          if (isExclusionViolation(error)) {
            return context.json({ error: 'Time slot already taken.', code: 'collision' }, { status: 409 })
          }
          throw error
        }
      }

      let parsed = s.parseSafe(appointmentCreateSchema, body)
      if (!parsed.success) {
        return context.json({ error: 'Validation failed.', errors: issuesToFieldErrors(parsed.issues) }, { status: 400 })
      }

      if (parsed.value.end_min - parsed.value.start_min < MINIMUM_DURATION) {
        return context.json({ error: `Minimum duration is ${MINIMUM_DURATION} minutes.` }, { status: 400 })
      }

      let bookable = await isSlotBookable(
        context.db,
        parsed.value.date,
        parsed.value.resource_id,
        parsed.value.start_min,
        parsed.value.end_min,
      )
      if (!bookable) {
        return context.json({ error: 'Slot is not bookable.' }, { status: 403 })
      }

      try {
        let appt = await createAppointment(context.db, userId, parsed.value)
        appointmentChannel.broadcast('invalidate')
        return context.json({ appointment: appt }, { status: 201 })
      } catch (error) {
        if (error instanceof AppointmentCollisionError) {
          return context.json({ error: error.message, code: 'collision' }, { status: error.status })
        }
        throw error
      }
    },

    async update(context) {
      let auth = context.auth
      if (!auth?.ok) {
        return context.json({ error: 'Authentication required.' }, { status: 401 })
      }
      let currentUser = auth.identity as User
      let userId = currentUser.id
      let isAdmin = currentUser.role === 'admin'

      if (!appointmentUpdateLimiter.attempt(userId)) {
        return context.json({ error: 'Too many requests. Please wait before updating.' }, { status: 429 })
      }

      let appointmentId = Number(context.params.id)

      let body: unknown
      try {
        body = await context.request.json()
      } catch {
        return context.json({ error: 'Expected a valid JSON request body.' }, { status: 400 })
      }

      let parsed = s.parseSafe(appointmentUpdateSchema, body)
      if (!parsed.success) {
        return context.json({ error: 'Validation failed.', errors: issuesToFieldErrors(parsed.issues) }, { status: 400 })
      }

      let { start_min, end_min } = parsed.value
      if (start_min !== undefined && end_min !== undefined && end_min - start_min < MINIMUM_DURATION) {
        return context.json({ error: `Minimum duration is ${MINIMUM_DURATION} minutes.` }, { status: 400 })
      }

      let hasSlotChange =
        parsed.value.date !== undefined ||
        parsed.value.start_min !== undefined ||
        parsed.value.end_min !== undefined ||
        parsed.value.resource_id !== undefined
      if (hasSlotChange) {
        let apptQuery: Record<string, unknown> = { id: appointmentId }
        if (!isAdmin) apptQuery.user_id = userId
        let current = await context.db.findOne(appointments, { where: apptQuery })
        if (!current) {
          return context.json({ error: 'Appointment not found.' }, { status: 404 })
        }
        let mergedDate = parsed.value.date ?? Number(current.date)
        let mergedStartMin = parsed.value.start_min ?? (current.start_min as number)
        let mergedEndMin = parsed.value.end_min ?? (current.end_min as number)
        let mergedResourceId = parsed.value.resource_id ?? (current.resource_id as number)
        let bookable = await isSlotBookable(context.db, mergedDate, mergedResourceId, mergedStartMin, mergedEndMin)
        if (!bookable) {
          return context.json({ error: 'Slot is not bookable.' }, { status: 403 })
        }
      }

      try {
        let appt = await updateAppointment(
          context.db,
          userId,
          appointmentId,
          parsed.value,
          isAdmin ? { adminBypass: true } : undefined,
        )
        appointmentChannel.broadcast('invalidate')
        return context.json({ appointment: appt })
      } catch (error) {
        if (error instanceof AppointmentError) {
          return context.json({ error: error.message }, { status: error.status })
        }
        throw error
      }
    },

    async destroy(context) {
      let auth = context.auth
      if (!auth?.ok) {
        return context.json({ error: 'Authentication required.' }, { status: 401 })
      }
      let currentUser = auth.identity as User
      let userId = currentUser.id
      let isAdmin = currentUser.role === 'admin'

      if (!appointmentDeleteLimiter.attempt(userId)) {
        return context.json({ error: 'Too many requests. Please wait before deleting.' }, { status: 429 })
      }

      let appointmentId = Number(context.params.id)

      try {
        await deleteAppointment(
          context.db,
          userId,
          appointmentId,
          isAdmin ? { adminBypass: true } : undefined,
        )
        appointmentChannel.broadcast('invalidate')
        return context.json({ deleted: true })
      } catch (error) {
        if (error instanceof AppointmentError) {
          return context.json({ error: error.message }, { status: error.status })
        }
        throw error
      }
    },

    async events(context) {
      return appointmentChannel.subscribe(context.request)
    },
  },
})

// ── AppointTypes ──

const appointTypeCreateSchema = s.object({
  title: s.string().pipe(minLength(1), maxLength(80)),
})

const appointTypeUpdateSchema = s.object({
  title: s.optional(s.string().pipe(minLength(1), maxLength(80))),
})

export const appointmentTypes = createController(
  routes.appointment.types,
  {
    middleware: [requireAuth()],

    actions: {
      async index(context) {
        let auth = context.auth
        if (!auth?.ok) {
          return new Response(null, { status: 401 })
        }
        let userId = (auth.identity as User).id

        let types = await listAppointTypes(context.db, userId)
        let csrfToken = getCsrfToken(context)

        let data = JSON.stringify({ types, csrfToken, appointmentTypesHref: routes.appointment.types.index.href() })

        return context.render(
          <>
            <script id="appointtype-data" type="application/json" nonce={getCspNonce()}>{data}</script>
            <AppointTypePanel csrfToken={csrfToken} />
          </>,
          fragmentResponseInit(),
        )
      },

      async create(context) {
        let auth = context.auth
        if (!auth?.ok) {
          return context.json({ error: 'Authentication required.' }, { status: 401 })
        }
        let userId = (auth.identity as User).id

        let body: unknown
        try {
          body = await context.request.json()
        } catch {
          return context.json({ error: 'Expected a valid JSON request body.' }, { status: 400 })
        }

        let parsed = s.parseSafe(appointTypeCreateSchema, body)
        if (!parsed.success) {
          return context.json({ error: 'Validation failed.', errors: issuesToFieldErrors(parsed.issues) }, { status: 400 })
        }

        let type = await createAppointType(context.db, userId, parsed.value)
        return context.json({ type }, { status: 201 })
      },

      async update(context) {
        let auth = context.auth
        if (!auth?.ok) {
          return context.json({ error: 'Authentication required.' }, { status: 401 })
        }
        let userId = (auth.identity as User).id
        let typeId = Number(context.params.id)

        let body: unknown
        try {
          body = await context.request.json()
        } catch {
          return context.json({ error: 'Expected a valid JSON request body.' }, { status: 400 })
        }

        let parsed = s.parseSafe(appointTypeUpdateSchema, body)
        if (!parsed.success) {
          return context.json({ error: 'Validation failed.', errors: issuesToFieldErrors(parsed.issues) }, { status: 400 })
        }

        try {
          let type = await updateAppointType(context.db, userId, typeId, parsed.value)
          return context.json({ type })
        } catch (error) {
          if (error instanceof AppointTypeError) {
            return context.json({ error: error.message }, { status: error.status })
          }
          throw error
        }
      },

      async destroy(context) {
        let auth = context.auth
        if (!auth?.ok) {
          return context.json({ error: 'Authentication required.' }, { status: 401 })
        }
        let userId = (auth.identity as User).id
        let typeId = Number(context.params.id)

        try {
          await deleteAppointType(context.db, userId, typeId)
          return context.json({ deleted: true })
        } catch (error) {
          if (error instanceof AppointTypeError) {
            return context.json({ error: error.message }, { status: error.status })
          }
          throw error
        }
      },
    },
  },
)
