import { tool } from 'ai'
import { z } from 'zod'
import { userLogger } from '../utils/logger.ts'

export const baseTools = {
  get_weather: tool({
    description: 'Get current weather for a location worldwide',
    inputSchema: z.object({
      location: z.string().min(1).max(30).describe('The city name (max 30 characters)'),
    }),
    execute: async ({ location }, { abortSignal }) => {
      let logger = userLogger('Workflow-tools')
      let externalController = new AbortController()
      let combinedSignal = abortSignal
        ? AbortSignal.any([abortSignal, externalController.signal])
        : externalController.signal
      let timeout = setTimeout(() => externalController.abort(), 10000)

      try {
        let geoResponse = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`,
          { signal: combinedSignal }
        )
        if (!geoResponse.ok) throw new Error('Geocoding failed')

        let geoData = await geoResponse.json() as {
          results?: Array<{ name: string; latitude: number; longitude: number; country?: string }>
        }
        if (!geoData.results?.[0]) throw new Error(`Location "${location}" not found`)

        let { latitude, longitude, name, country } = geoData.results[0]

        let weatherResponse = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`,
          { signal: combinedSignal }
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

  search_wikipedia: tool({
    description: 'Search Wikipedia for information',
    inputSchema: z.object({
      query: z.string().min(1).max(150).describe('The search query (max 150 characters)'),
    }),
    execute: async ({ query }, { abortSignal }) => {
      let logger = userLogger('Workflow-tools')
      let externalController = new AbortController()
      let signal = abortSignal ? AbortSignal.any([abortSignal, externalController.signal]) : externalController.signal
      let timeout = setTimeout(() => externalController.abort(), 8000)

      try {
        let res = await fetch(
          `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=5&format=json&origin=*`,
          { signal }
        )
        if (!res.ok) throw new Error('Wikipedia search failed')

        let data = await res.json()
        if (!Array.isArray(data) || data.length < 4) throw new Error('Wikipedia search returned unexpected format')

        let results: Array<{ title: string; description: string; url: string }> = []
        let titles = data[1] ?? []
        let descriptions = data[2] ?? []
        let urls = data[3] ?? []

        for (let i = 0; i < titles.length; i++) {
          if (typeof titles[i] === 'string' && typeof urls[i] === 'string') {
            results.push({
              title: titles[i],
              description: typeof descriptions[i] === 'string' ? descriptions[i] : '',
              url: urls[i],
            })
          }
        }

        return { query, results }
      } finally {
        clearTimeout(timeout)
      }
    },
  }),
}

export const workflowTools = {
  runQuery: tool({
    description: 'Execute a database query and return results',
    inputSchema: z.object({
      table: z.string().describe('Table name to query'),
      limit: z.number().optional().default(10).describe('Result limit'),
    }),
    execute: async ({ table }) => {
      let allowedTables = ['users', 'workflow_runs']
      if (!allowedTables.includes(table)) {
        throw new Error(`Table "${table}" not allowed. Allowed: ${allowedTables.join(', ')}`)
      }
      return { table, rows: [], message: 'Query tool - db access needs engine integration' }
    },
  }),

  sendNotification: tool({
    description: 'Send a notification via webhook',
    inputSchema: z.object({
      url: z.string().url().describe('Webhook URL'),
      subject: z.string().describe('Notification subject'),
      body: z.string().describe('Notification body'),
    }),
    execute: async ({ url, subject, body }) => {
      let response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body }),
      })
      return { success: response.ok, status: response.status }
    },
  }),
}

export const allTools = { ...baseTools, ...workflowTools }
