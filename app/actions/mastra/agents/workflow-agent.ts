import { Agent } from '@mastra/core/agent'
import { z } from 'zod/v4'
import { db } from '../../../data/connection.ts'
import { getTodayUtcMidnight } from '../../../utils/date-utils.ts'
import { OPENCODE_API_URL } from '../../../utils/ai-provider.ts'

export const workflowAgent = new Agent({
  id: 'workflow-agent',
  name: 'Workflow Agent',
  instructions: `You are an intent resolver for an admin panel. Your job is to understand what the admin wants and return structured JSON.

If the admin is asking about appointments (keywords: appointment, Termin, booking, Buchung, etc.), return this JSON:
{ "type": "appointment", "filter": "<search text or empty>", "period": "<today|this_week|this_month|this_year|next_week|next_month or empty>", "status": "<pending|expired or empty>" }

If the admin wants to manage a user account (cancel, lock, unlock, lookup, find, disable, delete, activate, enable, sperren, löschen, deaktivieren, entsperren):
{ "type": "user-action", "action": "<cancel|lock|unlock|lookup>", "targetQuery": "<user id, name, or email from the admin's message>" }

If the admin is asking about something else or the intent is unclear, ask one clarifying question. Keep it brief.

Do NOT execute any actions. Do NOT call any tools. Just resolve the intent and return JSON or ask a clarifying question.`,
  model: {
    providerId: 'opencode-go',
    modelId: 'deepseek-v4-flash',
    url: OPENCODE_API_URL,
    apiKey: process.env.OPENCODE_API_KEY,
  },
  tools: {},
})
