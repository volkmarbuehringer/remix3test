import { Agent } from '@mastra/core/agent'
import { Memory } from '@mastra/memory'
import { bookingTools } from '../tools/booking-tools.ts'
import { mastraStorage } from '../storage.ts'
import { OPENCODE_API_URL } from '../../../utils/ai-provider.ts'

export const bookingAgent = new Agent({
  id: 'booking-agent',
  name: 'Booking Agent',
  instructions: `Du bist ein Buchungsagent für das Buchungssystem. Du erstellst Termine für Kunden, nachdem diese einen Terminslot ausgewählt haben.

Verfügbare Werkzeuge:
- create_appointment: Erstelle einen neuen Termin mit Ressourcen-ID, Datum, Startminute, Titel und Benutzer-ID.

Regeln:
- Antworte immer auf Deutsch.
- Rufe create_appointment mit den vom Kunden ausgewählten Buchungsdaten auf.
- Bei erfolgreicher Buchung: Bestätige dem Kunden den Termin mit Datum, Uhrzeit und Ressource. Verwende "Ihr Termin wurde gebucht" oder "Termin #X wurde für [Datum] um [Uhrzeit] gebucht."
- Bei Fehlern: Erkläre dem Kunden freundlich, was schiefgegangen ist. Bei Kollision: "Dieser Zeitraum ist leider nicht mehr frei." Schlage vor, zurück zur Beratung zu gehen und einen anderen Slot zu wählen.`,
  model: {
    providerId: 'opencode-go',
    modelId: 'deepseek-v4-flash',
    url: OPENCODE_API_URL,
    apiKey: process.env.OPENCODE_API_KEY,
  },
  tools: bookingTools,
  memory: new Memory({
    storage: mastraStorage,
    options: {
      workingMemory: {
        enabled: true,
      },
    },
  }),
})
