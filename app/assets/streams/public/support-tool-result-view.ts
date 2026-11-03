/**
 * Display policy for support-agent tool results.
 *
 * The chat renders structured cards only for results an admin can read on
 * their own: a collection table, a single-entity detail, a weather time, a
 * timestamp, or a generated PDF. Everything else is stream plumbing (the
 * `search_tools` discovery payload, `{ success: true }` acknowledgements,
 * bare counts) and must not be pasted into the transcript as raw JSON.
 *
 * Kept as a pure descriptor so the policy is testable without a DOM; the
 * stream entry only turns the returned view into elements.
 */

export type SupportToolResultView =
  | { kind: 'skip' }
  | { kind: 'pdf'; filename: string; data: string }
  | { kind: 'table'; columns: string[]; rows: Array<Record<string, unknown>> }
  | { kind: 'empty'; text: string }
  | { kind: 'detail'; entries: Array<{ label: string; value: string }> }
  | { kind: 'note'; text: string }

/** Tool-discovery plumbing: its payload is context for the model, not output. */
const SILENT_TOOL_NAMES = new Set(['search_tools', 'load_tool', 'searchTools'])

const EMPTY_COLLECTION_TEXT = '✅ Keine Ergebnisse gefunden.'
const MAX_TABLE_ROWS = 20

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Render a scalar for a detail card; nested structures stay machine-readable. */
function displayValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

function weatherNote(result: Record<string, unknown>): string | null {
  if (typeof result.location !== 'string' || typeof result.temperature !== 'number') return null
  let parts = [`${result.temperature} °C`]
  if (typeof result.condition === 'string' && result.condition) parts.push(result.condition)
  if (typeof result.humidity === 'number') parts.push(`${result.humidity} %`)
  if (typeof result.windSpeed === 'number') parts.push(`${result.windSpeed} km/h`)
  return `🌤️ ${result.location}: ${parts.join(' · ')}`
}

function dateTimeNote(result: Record<string, unknown>): string | null {
  if (typeof result.formatted !== 'string' || typeof result.iso !== 'string') return null
  return `🕒 ${result.formatted}`
}

/**
 * Classifies one tool result for the support chat.
 *
 * `toolName` comes from the SSE event; the result alone cannot tell a
 * `search_tools` payload from a normal collection.
 */
export function describeSupportToolResult(
  toolName: string | undefined,
  result: unknown,
): SupportToolResultView {
  if (toolName && SILENT_TOOL_NAMES.has(toolName)) return { kind: 'skip' }
  if (!isRecord(result)) return { kind: 'skip' }

  let keys = Object.keys(result)
  if (keys.length === 0) return { kind: 'skip' }
  // Acknowledging tools (`{ success: true }`) have no display value.
  if (keys.length === 1 && keys[0] === 'success') return { kind: 'skip' }

  // Generated PDF → downloadable artifact.
  if (typeof result.data === 'string' && typeof result.reportType === 'string') {
    return {
      kind: 'pdf',
      filename: typeof result.filename === 'string' ? result.filename : 'bericht.pdf',
      data: result.data,
    }
  }

  let weather = weatherNote(result)
  if (weather) return { kind: 'note', text: weather }

  let dateTime = dateTimeNote(result)
  if (dateTime) return { kind: 'note', text: dateTime }

  // Collection result → table, or a clear empty state.
  let arrayKey = keys.find((key) => Array.isArray(result[key]))
  if (typeof result.count === 'number' && arrayKey) {
    let rows = (result[arrayKey] as unknown[]).filter(isRecord)
    if (rows.length === 0) return { kind: 'empty', text: EMPTY_COLLECTION_TEXT }
    return {
      kind: 'table',
      columns: Object.keys(rows[0] ?? {}),
      rows: rows.slice(0, MAX_TABLE_ROWS),
    }
  }

  // Single-entity detail → key/value card. Nested values (rules, configs) are
  // JSON, never the stringified-object `[object Object]`.
  if (result.found === true) {
    let entityKey = keys.find(
      (key) => key !== 'found' && key !== 'message' && isRecord(result[key]),
    )
    if (entityKey) {
      let entity = result[entityKey] as Record<string, unknown>
      return {
        kind: 'detail',
        entries: Object.entries(entity).map(([label, value]) => ({
          label,
          value: displayValue(value),
        })),
      }
    }
  }

  if (result.found === false && typeof result.message === 'string') {
    return { kind: 'note', text: result.message }
  }

  // Unknown shape: internal plumbing or data the agent should summarize in its
  // text answer. Dropping it keeps raw JSON out of the conversation.
  return { kind: 'skip' }
}
