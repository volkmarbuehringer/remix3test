import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { envString, isTest } from '../config.ts'

export const OPENCODE_API_URL = envString('OPENCODE_API_URL') ?? 'https://opencode.ai/zen/go/v1'

const OPENCODE_SESSION_FILE = join(import.meta.dirname, '../../.opencode-session-id')

let _sessionId: string | null = null

/**
 * Stable id sent as the provider session header.
 *
 * Deliberately ignores `OPENCODE_SESSION_ID` from the environment: agent
 * harnesses export that name for their own sessions, so reading it would make
 * the app's id change whenever the surrounding agent session does. The
 * persisted file is the single source of truth.
 */
export function getOpenCodeSessionId(): string {
  if (_sessionId) return _sessionId
  _sessionId = loadOrCreateSessionId()
  return _sessionId
}

function loadOrCreateSessionId(): string {
  if (!isTest) {
    try {
      if (existsSync(OPENCODE_SESSION_FILE)) {
        let existing = readFileSync(OPENCODE_SESSION_FILE, 'utf8').trim()
        if (existing) return existing
      }
      let id = randomUUID()
      writeFileSync(OPENCODE_SESSION_FILE, id, { encoding: 'utf8' })
      return id
    } catch (err) {
      console.warn(
        '[ai-provider] Could not persist OpenCode session id, using in-memory value:',
        err,
      )
    }
  }
  return randomUUID()
}
