import type { EventHandler, BaseEvent } from '../event-bus.ts'
import { INTENTS } from '../intents.ts'

const TARGET_STOPWORDS = new Set([
  // English auxiliaries / articles / filler
  'i',
  'we',
  'you',
  'he',
  'she',
  'they',
  'want',
  'wants',
  'to',
  'a',
  'an',
  'the',
  'for',
  'of',
  'and',
  'please',
  'user',
  'users',
  'account',
  // German auxiliaries / articles / filler
  'ich',
  'wir',
  'sie',
  'er',
  'will',
  'möchte',
  'mochte',
  'bitte',
  'für',
  'fuer',
  'und',
  'den',
  'die',
  'das',
  'dem',
  'der',
  'ein',
  'eine',
  'einen',
  'benutzer',
  'benutzerkonto',
  'konto',
  'account',
  // English action verbs
  'cancel',
  'cancels',
  'canceled',
  'cancelled',
  'lock',
  'locks',
  'locked',
  'unlock',
  'unlocks',
  'unlocked',
  'show',
  'shows',
  'find',
  'finds',
  'delete',
  'deletes',
  'deleted',
  'lookup',
  // German action verbs (incl. inflections)
  'kündigen',
  'kündige',
  'kündigt',
  'kündigung',
  'kuendigen',
  'löschen',
  'lösche',
  'löscht',
  'loeschen',
  'stornieren',
  'storniere',
  'storniert',
  'sperren',
  'sperre',
  'sperrt',
  'sperrung',
  'entsperren',
  'entsperre',
  'entsperrt',
  'entsperrung',
  'blockieren',
  'blockiere',
  'blockiert',
  'deaktivieren',
  'deaktiviere',
  'deaktiviert',
  'aktivieren',
  'aktiviere',
  'aktiviert',
  'freischalten',
  'freischalte',
  'freigeschaltet',
  'suchen',
  'suche',
  'sucht',
  'finden',
  'finde',
  'findet',
  'zeigen',
  'zeige',
  'zeigt',
  'anzeigen',
  'appointments',
  'termine',
  'termin',
  'buchungen',
  'buchung',
])

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
        params: { targetQuery: extractTarget(e.message) },
        adminUserId: e.adminUserId,
        adminEmail: e.adminEmail,
      })
    }

    if (
      message.includes('cancel') ||
      message.includes('lösch') ||
      message.includes('loesch') ||
      message.includes('kündig') ||
      message.includes('kuendig') ||
      message.includes('stornier') ||
      message.includes('delet')
    ) {
      classify(INTENTS.CANCEL_USER)
    } else if (
      message.includes('lock') ||
      message.includes('sperr') ||
      message.includes('blockier') ||
      message.includes('deaktivier')
    ) {
      classify(INTENTS.LOCK_USER)
    } else if (
      message.includes('unlock') ||
      message.includes('entsperr') ||
      message.includes('freischalt') ||
      message.includes('aktivier')
    ) {
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
  let nameTokens = tokens.filter((t) => !TARGET_STOPWORDS.has(t.toLowerCase()))
  if (nameTokens.length > 0) return nameTokens.join(' ')
  for (let i = tokens.length - 1; i >= 0; i--) {
    let t = tokens[i]
    if (t.length > 2) return t
  }
  return ''
}
