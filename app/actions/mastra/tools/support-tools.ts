import { createTool } from '@mastra/core/tools'
import { z } from 'zod/v4'
import Holidays from 'date-holidays'
import { db } from '../../../db.ts'
import { sql } from 'remix/data-table'
import {
  users,
  appointments,
  resources,
  messages,
  appointofferings,
  offeringConfigs,
  appointtypes,
} from '../../../data/schema.ts'
import { generatePdfBuffer } from '../../../utils/pdf-utils.ts'
import type { TDocumentDefinitions } from 'pdfmake/interfaces.js'
export const supportTools = {
  lookupUser: createTool({
    id: 'lookup_user',
    description:
      'Look up a user by ID or email address. Returns id, name, email, role, disabled status (disabledAt timestamp, null if active), and created_at.',
    inputSchema: z.object({
      query: z.string().min(1).max(200).describe('Numeric user ID or email address'),
    }),
    execute: async ({ query }) => {
      let isNumeric = /^\d+$/.test(query)
      let rows = await db.exec(
        isNumeric
          ? sql`SELECT id, email, name, role, email_verified, disabled_at, created_at FROM users WHERE id = ${Number(query)} OR email = ${query} LIMIT 1`
          : sql`SELECT id, email, name, role, email_verified, disabled_at, created_at FROM users WHERE email = ${query} LIMIT 1`,
      )
      let user = (rows.rows ?? [])[0] as
        | {
            id: number
            email: string
            name: string
            role: string
            email_verified: number
            disabled_at: number | null
            created_at: number
          }
        | undefined
      if (!user) return { found: false, message: 'No user found matching that query' }
      return {
        found: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          emailVerified: user.email_verified === 1 ? 'yes' : 'no',
          disabledAt: user.disabled_at,
          createdAt: user.created_at,
        },
      }
    },
  }),

  listRecentAppointments: createTool({
    id: 'list_recent_appointments',
    description:
      'List recent appointments. Optionally filter by user_id. Returns id, title, date, time range, and user name.',
    inputSchema: z.object({
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .default(10)
        .describe('Maximum appointments to return (1-50)'),
      userId: z.number().int().optional().describe('Filter by user ID'),
    }),
    execute: async ({ limit, userId }) => {
      let result = await db.exec(
        sql`SELECT a.id, a.title, a.date, a.during, a.user_id, u.name as user_name
          FROM appointments a LEFT JOIN users u ON a.user_id = u.id
          ${userId !== undefined ? sql`WHERE a.user_id = ${userId}` : sql``}
          ORDER BY a.created_at DESC LIMIT ${limit}`,
      )
      let rows = result.rows ?? []
      return {
        count: rows.length,
        appointments: rows.map((r: any) => ({
          id: r.id,
          title: r.title,
          date: r.date,
          timeRange: r.during,
          userName: r.user_name ?? 'Unknown',
        })),
      }
    },
  }),

  countUsers: createTool({
    id: 'count_users',
    description:
      'Count total users, optionally filtered by role (e.g. "admin", "customer"). Returns counts grouped by role.',
    inputSchema: z.object({
      role: z.string().optional().describe('Filter by role (e.g. "admin" or "customer")'),
    }),
    execute: async ({ role }) => {
      let result = await db.exec(
        role
          ? sql`SELECT role, count(*)::int as count FROM users WHERE role = ${role} GROUP BY role ORDER BY role`
          : sql`SELECT role, count(*)::int as count FROM users GROUP BY role ORDER BY role`,
      )
      let byRole: Record<string, number> = {}
      for (let r of (result.rows ?? []) as { role: string; count: number }[]) {
        byRole[r.role] = r.count
      }
      let total = Object.values(byRole).reduce((a, b) => a + b, 0)
      return { total, byRole }
    },
  }),

  getCurrentDateTime: createTool({
    id: 'get_current_date_time',
    description:
      'Get the current date and time. Returns today\'s date, day of week, and current time. Useful for determining context like "today", "this week", "this month" queries.',
    inputSchema: z.object({}),
    execute: async () => {
      let now = new Date()
      let deFormatter = new Intl.DateTimeFormat('de-DE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      })
      return {
        iso: now.toISOString(),
        formatted: deFormatter.format(now),
        weekday: now.toLocaleDateString('en-US', { weekday: 'long' }),
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate(),
        hours: now.getHours(),
        minutes: now.getMinutes(),
        unixMs: now.getTime(),
      }
    },
  }),

  getWeather: createTool({
    id: 'get_weather',
    description:
      'Get current weather for a location worldwide. Returns temperature, condition, humidity, and wind speed for any city.',
    inputSchema: z.object({
      location: z.string().min(1).max(30).describe('The city name (max 30 characters)'),
    }),
    execute: async ({ location }) => {
      let controller = new AbortController()
      let timeout = setTimeout(() => controller.abort(), 10000)

      try {
        let geoResponse = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`,
          { signal: controller.signal },
        )
        if (!geoResponse.ok) throw new Error('Geocoding failed')

        let geoData = (await geoResponse.json()) as {
          results?: Array<{ name: string; latitude: number; longitude: number; country?: string }>
        }
        if (!geoData.results?.[0]) throw new Error(`Location "${location}" not found`)

        let { latitude, longitude, name, country } = geoData.results[0]

        let weatherResponse = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`,
          { signal: controller.signal },
        )
        if (!weatherResponse.ok) throw new Error('Weather fetch failed')

        let weatherData = (await weatherResponse.json()) as {
          current?: {
            temperature_2m: number
            relative_humidity_2m: number
            weather_code: number
            wind_speed_10m: number
          }
        }
        if (!weatherData.current) throw new Error('Weather data unavailable')

        let conditions: Record<number, string> = {
          0: 'Clear sky',
          1: 'Mainly clear',
          2: 'Partly cloudy',
          3: 'Overcast',
          45: 'Foggy',
          48: 'Depositing rime fog',
          51: 'Light drizzle',
          53: 'Moderate drizzle',
          55: 'Dense drizzle',
          61: 'Slight rain',
          63: 'Moderate rain',
          65: 'Heavy rain',
          71: 'Slight snow',
          73: 'Moderate snow',
          75: 'Heavy snow',
          80: 'Slight rain showers',
          81: 'Moderate rain showers',
          82: 'Violent rain showers',
          95: 'Thunderstorm',
          96: 'Thunderstorm with slight hail',
          99: 'Thunderstorm with heavy hail',
        }

        return {
          location: `${name}, ${country ?? 'Unknown'}`,
          temperature: Math.round(weatherData.current.temperature_2m),
          condition: conditions[weatherData.current.weather_code] ?? 'Unknown',
          humidity: weatherData.current.relative_humidity_2m,
          windSpeed: Math.round(weatherData.current.wind_speed_10m),
        }
      } finally {
        clearTimeout(timeout)
      }
    },
  }),

  getResourceDetails: createTool({
    id: 'get_resource_details',
    description: 'Look up a resource by ID or name. Returns id, name, description, and timestamps.',
    inputSchema: z.object({
      query: z.string().min(1).max(200).describe('Numeric resource ID or resource name'),
    }),
    execute: async ({ query }) => {
      let isNumeric = /^\d+$/.test(query)
      let rows = await db.exec(
        isNumeric
          ? sql`SELECT id, name, description, created_at, updated_at FROM resources WHERE id = ${Number(query)} OR name = ${query} LIMIT 1`
          : sql`SELECT id, name, description, created_at, updated_at FROM resources WHERE name = ${query} LIMIT 1`,
      )
      let r = (rows.rows ?? [])[0] as
        | { id: number; name: string; description: string; created_at: number; updated_at: number }
        | undefined
      if (!r) return { found: false, message: 'No resource found matching that query' }
      return {
        found: true,
        resource: {
          id: r.id,
          name: r.name,
          description: r.description,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        },
      }
    },
  }),

  getOfferingsForDate: createTool({
    id: 'get_offerings_for_date',
    description:
      'Get all offering slots for a specific date. Returns time ranges and resource names. Use this for availability queries like "what is available on [date]".',
    inputSchema: z.object({
      date: z
        .string()
        .min(1)
        .max(30)
        .describe('Date in ISO format (YYYY-MM-DD) or unix millisecond timestamp string'),
    }),
    execute: async ({ date }) => {
      let timestamp: number
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        timestamp = new Date(date + 'T00:00:00Z').getTime()
      } else {
        timestamp = Number(date)
      }
      if (Number.isNaN(timestamp)) return { error: 'Invalid date format. Use YYYY-MM-DD.' }

      let result = await db.exec(sql`
        SELECT ao.id, ao.day, ao.resource_id, ao.during, ao.created_at, ao.updated_at,
               r.name AS resource_name, r.description AS resource_description
        FROM appointoffering ao
        LEFT JOIN resources r ON r.id = ao.resource_id
        WHERE ao.day = ${timestamp}
        ORDER BY ao.during ASC
      `)
      let rows = result.rows ?? []
      return {
        date,
        count: rows.length,
        offerings: rows.map((r: any) => ({
          id: r.id,
          resourceId: r.resource_id,
          resourceName: r.resource_name ?? 'Unknown',
          timeRange: r.during,
        })),
      }
    },
  }),

  searchAppointmentsByDateRange: createTool({
    id: 'search_appointments_by_date_range',
    description:
      'Search appointments within a date range. Requires both startDate and endDate in ISO format (YYYY-MM-DD). Max range is 90 days. Results limited to 50.',
    inputSchema: z.object({
      startDate: z.string().min(1).max(30).describe('Start date in ISO format (YYYY-MM-DD)'),
      endDate: z.string().min(1).max(30).describe('End date in ISO format (YYYY-MM-DD)'),
    }),
    execute: async ({ startDate, endDate }) => {
      let startTs = new Date(startDate + 'T00:00:00Z').getTime()
      let endTs = new Date(endDate + 'T23:59:59Z').getTime()
      if (Number.isNaN(startTs) || Number.isNaN(endTs)) {
        return { error: 'Invalid date format. Use YYYY-MM-DD.' }
      }
      let rangeDays = (endTs - startTs) / 86400000
      if (rangeDays > 90) return { error: 'Date range exceeds maximum of 90 days' }
      if (rangeDays < 0) return { error: 'startDate must be before endDate' }

      let result = await db.exec(sql`
        SELECT a.id, a.title, a.date, a.during, a.user_id, u.name AS user_name,
               r.name AS resource_name
        FROM appointments a
        LEFT JOIN users u ON a.user_id = u.id
        LEFT JOIN resources r ON r.id = a.resource_id
        WHERE a.date >= ${startTs} AND a.date <= ${endTs}
        ORDER BY a.date ASC
        LIMIT 50
      `)
      let rows = result.rows ?? []
      return {
        count: rows.length,
        startDate,
        endDate,
        appointments: rows.map((r: any) => ({
          id: r.id,
          title: r.title,
          date: r.date,
          timeRange: r.during,
          userName: r.user_name ?? 'Unknown',
          resourceName: r.resource_name ?? 'Unknown',
        })),
      }
    },
  }),

  getUserAppointments: createTool({
    id: 'get_user_appointments',
    description:
      'Get all appointments for a specific user by user ID. Returns most recent 50 appointments with dates and titles.',
    inputSchema: z.object({
      userId: z.number().int().describe('The numeric user ID'),
    }),
    execute: async ({ userId }) => {
      let result = await db.exec(sql`
        SELECT a.id, a.title, a.date, a.during, r.name AS resource_name
        FROM appointments a
        LEFT JOIN resources r ON r.id = a.resource_id
        WHERE a.user_id = ${userId}
        ORDER BY a.date DESC
        LIMIT 50
      `)
      let rows = result.rows ?? []
      return {
        count: rows.length,
        appointments: rows.map((r: any) => ({
          id: r.id,
          title: r.title,
          date: r.date,
          timeRange: r.during,
          resourceName: r.resource_name ?? 'Unknown',
        })),
      }
    },
  }),

  getAppointmentDetails: createTool({
    id: 'get_appointment_details',
    description:
      'Get full details for a single appointment by ID. Returns title, date, time range, user name, resource name, and timestamps.',
    inputSchema: z.object({
      id: z.number().int().describe('The appointment ID'),
    }),
    execute: async ({ id }) => {
      let result = await db.exec(sql`
        SELECT a.id, a.title, a.date, a.during, a.created_at, a.updated_at,
               u.name AS user_name, u.email AS user_email,
               r.name AS resource_name
        FROM appointments a
        LEFT JOIN users u ON a.user_id = u.id
        LEFT JOIN resources r ON r.id = a.resource_id
        WHERE a.id = ${id}
        LIMIT 1
      `)
      let rows = result.rows ?? []
      if (rows.length === 0) return { found: false, message: 'No appointment found with that ID' }
      let r = rows[0]
      return {
        found: true,
        appointment: {
          id: r.id,
          title: r.title,
          date: r.date,
          timeRange: r.during,
          userName: r.user_name ?? 'Unknown',
          userEmail: r.user_email ?? 'Unknown',
          resourceName: r.resource_name ?? 'Unknown',
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        },
      }
    },
  }),

  getOfferingConfigForResource: createTool({
    id: 'get_offering_config_for_resource',
    description:
      'Get the offering configuration (rules) for a resource by resource ID. Returns config id, resource id, and rules object.',
    inputSchema: z.object({
      resourceId: z.number().int().describe('The numeric resource ID'),
    }),
    execute: async ({ resourceId }) => {
      let r = await db.findOne(offeringConfigs, { where: { resource_id: resourceId } })
      if (!r) return { found: false, message: 'No offering config found for that resource' }
      return {
        found: true,
        config: {
          id: r.id,
          resourceId: r.resource_id,
          rules: r.rules,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        },
      }
    },
  }),

  getAppointTypes: createTool({
    id: 'get_appoint_types',
    description: 'List all appointment types. Returns type IDs and titles.',
    inputSchema: z.object({}),
    execute: async () => {
      let types = await db.findMany(appointtypes, { orderBy: [['title', 'asc']] })
      return {
        count: types.length,
        types: types.map((r) => ({
          id: r.id,
          title: r.title,
        })),
      }
    },
  }),

  searchMessages: createTool({
    id: 'search_messages',
    description:
      'Search messages by content text or sender ID. Returns message content, sender name, and timestamp. Results limited to 50.',
    inputSchema: z.object({
      query: z.string().min(1).max(200).describe('Search term to find in message content'),
      senderId: z.number().int().optional().describe('Optional sender user ID to filter by'),
    }),
    execute: async ({ query, senderId }) => {
      let pattern = `%${query.replace(/[%_\\]/g, '\\$&')}%`
      let result = await db.exec(
        senderId !== undefined
          ? sql`SELECT m.id, m.sender_id, u.name AS sender_name, m.content, m.created_at
               FROM messages m LEFT JOIN users u ON m.sender_id = u.id
               WHERE m.content ILIKE ${pattern} AND m.sender_id = ${senderId}
               ORDER BY m.created_at DESC LIMIT 50`
          : sql`SELECT m.id, m.sender_id, u.name AS sender_name, m.content, m.created_at
               FROM messages m LEFT JOIN users u ON m.sender_id = u.id
               WHERE m.content ILIKE ${pattern}
               ORDER BY m.created_at DESC LIMIT 50`,
      )
      let rows = result.rows ?? []
      return {
        count: rows.length,
        messages: rows.map((r: any) => ({
          id: r.id,
          senderId: r.sender_id,
          senderName: r.sender_name ?? 'Unknown',
          content: r.content,
          createdAt: r.created_at,
        })),
      }
    },
  }),

  getAdminStats: createTool({
    id: 'get_admin_stats',
    description:
      'Get aggregate dashboard statistics. Returns total users by role, total appointments (optionally filtered by date range), total resources, and total messages.',
    inputSchema: z.object({
      startDate: z
        .string()
        .optional()
        .describe('Optional start date (YYYY-MM-DD) to filter appointments'),
      endDate: z
        .string()
        .optional()
        .describe('Optional end date (YYYY-MM-DD) to filter appointments'),
    }),
    execute: async ({ startDate, endDate }) => {
      let userResult = await db.exec(
        sql`SELECT role, count(*)::int AS count FROM users GROUP BY role ORDER BY role`,
      )
      let byRole: Record<string, number> = {}
      for (let r of (userResult.rows ?? []) as { role: string; count: number }[]) {
        byRole[r.role] = r.count
      }
      let totalUsers = Object.values(byRole).reduce((a, b) => a + b, 0)

      let hasStart = startDate !== undefined
      let hasEnd = endDate !== undefined
      if (hasStart !== hasEnd) {
        return { error: 'Both startDate and endDate are required to filter appointments' }
      }
      let apptCount: number
      if (hasStart && hasEnd) {
        let startTs = new Date(startDate + 'T00:00:00Z').getTime()
        let endTs = new Date(endDate + 'T23:59:59Z').getTime()
        if (Number.isNaN(startTs) || Number.isNaN(endTs)) {
          return { error: 'Invalid date format. Use YYYY-MM-DD.' }
        }
        let apptResult = await db.exec(
          sql`SELECT count(*)::int AS count FROM appointments WHERE date >= ${startTs} AND date <= ${endTs}`,
        )
        apptCount = Number((apptResult.rows ?? [])[0]?.count ?? 0)
      } else {
        apptCount = await db.count(appointments)
      }

      let resourceCount = await db.count(resources)
      let messageCount = await db.count(messages)

      return {
        users: { total: totalUsers, byRole },
        appointments: { total: apptCount },
        resources: { total: resourceCount },
        messages: { total: messageCount },
      }
    },
  }),

  lookupHoliday: createTool({
    id: 'lookup_holiday',
    description:
      'Check if a given date is a public holiday in Rhineland-Palatinate, Germany. Returns the holiday name if applicable.',
    inputSchema: z.object({
      date: z.string().min(1).max(30).describe('Date in ISO format (YYYY-MM-DD)'),
    }),
    execute: async ({ date }) => {
      let parsed = new Date(date + 'T00:00:00Z')
      if (Number.isNaN(parsed.getTime())) return { error: 'Invalid date format. Use YYYY-MM-DD.' }
      let hd = new Holidays('DE', 'RP')
      let holiday = hd.isHoliday(parsed)
      if (holiday !== false) {
        let h = (Array.isArray(holiday) ? holiday[0] : holiday) as { name: string; type: string }
        return { isHoliday: true, name: h.name, type: h.type, date }
      }
      return { isHoliday: false, name: null, date }
    },
  }),

  generatePdfReport: createTool({
    id: 'generate_pdf_report',
    description:
      'Generate a PDF report for a predefined type. Supported types: "appointment-list" (appointments in a date range), "user-list" (all users with role). Returns base64-encoded PDF data.',
    inputSchema: z.object({
      reportType: z.enum(['appointment-list', 'user-list']).describe('Type of report to generate'),
      startDate: z
        .string()
        .optional()
        .describe('Start date (YYYY-MM-DD) for appointment-list reports'),
      endDate: z.string().optional().describe('End date (YYYY-MM-DD) for appointment-list reports'),
    }),
    execute: async ({ reportType, startDate, endDate }) => {
      if (reportType === 'appointment-list') {
        if (!startDate || !endDate) {
          return { error: 'startDate and endDate are required for appointment-list reports' }
        }
        let startTs = new Date(startDate + 'T00:00:00Z').getTime()
        let endTs = new Date(endDate + 'T23:59:59Z').getTime()
        if (Number.isNaN(startTs) || Number.isNaN(endTs)) {
          return { error: 'Invalid date format. Use YYYY-MM-DD.' }
        }
        let rangeDays = (endTs - startTs) / 86400000
        if (rangeDays > 90) return { error: 'Date range exceeds maximum of 90 days' }
        if (rangeDays < 0) return { error: 'startDate must be before endDate' }
        let result = await db.exec(sql`
          SELECT a.title, a.date, a.during, u.name AS user_name, r.name AS resource_name
          FROM appointments a
          LEFT JOIN users u ON a.user_id = u.id
          LEFT JOIN resources r ON r.id = a.resource_id
          WHERE a.date >= ${startTs} AND a.date <= ${endTs}
          ORDER BY a.date ASC
          LIMIT 500
        `)
        let rows = result.rows ?? []
        let docDef: TDocumentDefinitions = {
          content: [
            { text: `Appointment Report: ${startDate} to ${endDate}`, style: 'header' },
            { text: `Generated: ${new Date().toISOString().slice(0, 10)}`, style: 'subheader' },
            { text: '', margin: [0, 10, 0, 0] },
            {
              table: {
                headerRows: 1,
                widths: ['*', 'auto', 'auto', '*', '*'],
                body: [
                  ['Title', 'Date', 'Time', 'User', 'Resource'],
                  ...rows.map((r: any) => [
                    r.title,
                    new Date(r.date).toISOString().slice(0, 10),
                    r.during,
                    r.user_name ?? 'Unknown',
                    r.resource_name ?? 'Unknown',
                  ]),
                ],
              },
            },
          ],
          styles: {
            header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] },
            subheader: { fontSize: 12, color: '#666', margin: [0, 0, 0, 20] },
          },
        }
        let buf = await generatePdfBuffer(docDef)
        return {
          filename: `appointments-${startDate}-to-${endDate}.pdf`,
          data: buf.toString('base64'),
          size: buf.length,
          reportType: 'appointment-list',
        }
      }

      if (reportType === 'user-list') {
        let users_list = await db.findMany(users, { orderBy: [['name', 'asc']], limit: 500 })
        let docDef: TDocumentDefinitions = {
          content: [
            { text: 'User Report', style: 'header' },
            { text: `Generated: ${new Date().toISOString().slice(0, 10)}`, style: 'subheader' },
            { text: '', margin: [0, 10, 0, 0] },
            {
              table: {
                headerRows: 1,
                widths: ['auto', '*', '*', 'auto', 'auto'],
                body: [
                  ['ID', 'Name', 'Email', 'Role', 'Verified'],
                  ...users_list.map((r) => [
                    String(r.id),
                    r.name,
                    r.email,
                    r.role,
                    r.email_verified === 1 ? 'Yes' : 'No',
                  ]),
                ],
              },
            },
          ],
          styles: {
            header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] },
            subheader: { fontSize: 12, color: '#666', margin: [0, 0, 0, 20] },
          },
        }
        let buf = await generatePdfBuffer(docDef)
        return {
          filename: `users-${new Date().toISOString().slice(0, 10)}.pdf`,
          data: buf.toString('base64'),
          size: buf.length,
          reportType: 'user-list',
        }
      }

      return { error: 'Unknown report type. Supported types: appointment-list, user-list' }
    },
  }),

  getLocationContext: createTool({
    id: 'get_location_context',
    description:
      'Get the system default location context: Ransbach-Baumbach, Rhineland-Palatinate, Germany. Use this when you need the default location for weather queries, timezone information, or any location-based question.',
    inputSchema: z.object({}),
    execute: async () => ({
      city: 'Ransbach-Baumbach',
      region: 'Rhineland-Palatinate',
      country: 'Germany',
      countryCode: 'DE',
      timezone: 'Europe/Berlin',
      latitude: 50.4667,
      longitude: 7.7333,
    }),
  }),
}
