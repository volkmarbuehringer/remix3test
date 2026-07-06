import { createTool } from '@mastra/core/tools'
import { z } from 'zod/v4'
import { pool } from '../../../data/connection.ts'

export const supportTools = {
  lookupUser: createTool({
    id: 'lookup_user',
    description: 'Look up a user by ID or email address. Returns id, name, email, role, and account status.',
    inputSchema: z.object({
      query: z.string().min(1).max(200).describe('Numeric user ID or email address'),
    }),
    execute: async ({ query }) => {
      let client = await pool.connect()
      try {
        let isNumeric = /^\d+$/.test(query)
        let result
        if (isNumeric) {
          result = await client.query(
            'SELECT id, email, name, role, email_verified, created_at FROM users WHERE id = $1 OR email = $2 LIMIT 1',
            [Number(query), query],
          )
        } else {
          result = await client.query(
            'SELECT id, email, name, role, email_verified, created_at FROM users WHERE email = $1 LIMIT 1',
            [query],
          )
        }
        let rows = result.rows
        if (rows.length === 0) return { found: false, message: 'No user found matching that query' }
        let user = rows[0]
        return {
          found: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            emailVerified: user.email_verified === 1 ? 'yes' : 'no',
            createdAt: user.created_at,
          },
        }
      } finally {
        client.release()
      }
    },
  }),

  listRecentAppointments: createTool({
    id: 'list_recent_appointments',
    description: 'List recent appointments. Optionally filter by user_id. Returns id, title, date, time range, and user name.',
    inputSchema: z.object({
      limit: z.number().int().min(1).max(50).optional().default(10).describe('Maximum appointments to return (1-50)'),
      userId: z.number().int().optional().describe('Filter by user ID'),
    }),
    execute: async ({ limit, userId }) => {
      let client = await pool.connect()
      try {
        let whereClause = userId !== undefined ? ' AND a.user_id = $2' : ''
        let query = `SELECT a.id, a.title, a.date, a.during, a.user_id, u.name as user_name
          FROM appointments a LEFT JOIN users u ON a.user_id = u.id
          WHERE 1=1${whereClause}
          ORDER BY a.created_at DESC LIMIT $1`
        let params: unknown[] = [limit]
        if (userId !== undefined) params.push(userId)
        let result = await client.query(query, params)
        return {
          count: result.rows.length,
          appointments: result.rows.map(r => ({
            id: r.id,
            title: r.title,
            date: r.date,
            timeRange: r.during,
            userName: r.user_name ?? 'Unknown',
          })),
        }
      } finally {
        client.release()
      }
    },
  }),

  countUsers: createTool({
    id: 'count_users',
    description: 'Count total users, optionally filtered by role (e.g. "admin", "customer"). Returns counts grouped by role.',
    inputSchema: z.object({
      role: z.string().optional().describe('Filter by role (e.g. "admin" or "customer")'),
    }),
    execute: async ({ role }) => {
      let client = await pool.connect()
      try {
        let whereClause = role ? ' WHERE role = $1' : ''
        let query = `SELECT role, count(*)::int as count FROM users${whereClause} GROUP BY role ORDER BY role`
        let params: unknown[] = role ? [role] : []
        let result = await client.query(query, params)
        let byRole: Record<string, number> = {}
        for (let r of result.rows) {
          byRole[r.role] = r.count
        }
        let total = Object.values(byRole).reduce((a, b) => a + b, 0)
        return { total, byRole }
      } finally {
        client.release()
      }
    },
  }),

  getCurrentDateTime: createTool({
    id: 'get_current_date_time',
    description: 'Get the current date and time. Returns today\'s date, day of week, and current time. Useful for determining context like "today", "this week", "this month" queries.',
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
    description: 'Get current weather for a location worldwide. Returns temperature, condition, humidity, and wind speed for any city.',
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

        let geoData = await geoResponse.json() as {
          results?: Array<{ name: string; latitude: number; longitude: number; country?: string }>
        }
        if (!geoData.results?.[0]) throw new Error(`Location "${location}" not found`)

        let { latitude, longitude, name, country } = geoData.results[0]

        let weatherResponse = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`,
          { signal: controller.signal },
        )
        if (!weatherResponse.ok) throw new Error('Weather fetch failed')

        let weatherData = await weatherResponse.json() as {
          current?: { temperature_2m: number; relative_humidity_2m: number; weather_code: number; wind_speed_10m: number }
        }
        if (!weatherData.current) throw new Error('Weather data unavailable')

        let conditions: Record<number, string> = {
          0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
          45: 'Foggy', 48: 'Depositing rime fog', 51: 'Light drizzle', 53: 'Moderate drizzle',
          55: 'Dense drizzle', 61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
          71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
          80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
          95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail',
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
}
