import type { EventHandler, BaseEvent } from '../event-bus.ts'
import { INTENTS } from '../intents.ts'

export const classifyHandler: EventHandler = {
  name: 'classify',
  eventType: 'request.validated',
  async handle(event, emit) {
    let e = event as BaseEvent & { type: 'request.validated' }
    let message = e.message.toLowerCase()

    let classify = (intent: string) => {
      emit({
        type: 'intent.classified',
        intent,
        params: { targetQuery: extractTarget(message) },
        adminUserId: e.adminUserId,
        adminEmail: e.adminEmail,
      })
    }

    if (message.includes('cancel') || message.includes('löschen')) {
      classify(INTENTS.CANCEL_USER)
    } else if (message.includes('lock') || message.includes('sperren')) {
      classify(INTENTS.LOCK_USER)
    } else if (message.includes('unlock') || message.includes('entsperren')) {
      classify(INTENTS.UNLOCK_USER)
    } else if (
      message.includes('show') ||
      message.includes('zeige') ||
      message.includes('appointments') ||
      message.includes('termine')
    ) {
      classify(INTENTS.SHOW_APPOINTMENTS)
    } else {
      emit({ type: 'intent.unclear', text: `Could not resolve intent from: "${e.message}"` })
    }
  },
}

function extractTarget(message: string): string {
  let tokens = message.split(/\s+/)
  for (let i = 0; i < tokens.length; i++) {
    let t = tokens[i]
    if (/^\d+$/.test(t)) return t
    if (t.includes('@')) return t
  }
  let lastToken = tokens[tokens.length - 1]
  if (
    lastToken &&
    lastToken.length > 2 &&
    !/\b(cancel|lock|unlock|show|zeige|appointments|termine|user|benutzer)\b/.test(lastToken)
  ) {
    return lastToken
  }
  return ''
}
