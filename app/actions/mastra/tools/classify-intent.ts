import { createTool } from '@mastra/core/tools'
import { z } from 'zod/v4'
import { classifyWithAgent, resolveWorkflowAgent } from '../intent-classifier.ts'
import { MAX_MESSAGE_LENGTH } from '../../../utils/message-limits.ts'

/**
 * Resolves a mutating admin request into the same structured intent the
 * Agent-Events pipeline classifies.
 *
 * The support agent is read-only, so this tool only *recognizes* a mutation:
 * the change itself still runs through Agent-Events' confirmation workflow.
 * Both this tool and the Agent-Events classify handler resolve the workflow
 * agent through the shared `resolveWorkflowAgent()`, so they cannot drift.
 */
export const classifyIntentTool = createTool({
  id: 'classify_intent',
  description:
    'Resolve an admin request that would change account or appointment data into a structured intent (cancel, lock, unlock, or look up a user; show or delete appointments). Use this when the admin asks for one of those changes. This agent is read-only: report the resolved intent and direct the admin to the Agent-Events surface rather than performing the change.',
  inputSchema: z.object({
    // Bounded by the same limit the chat composer and server validation use, so
    // the agent can pass the admin's request verbatim without a schema failure.
    message: z
      .string()
      .min(1)
      .max(MAX_MESSAGE_LENGTH)
      .describe("The admin's request in their own words"),
  }),
  outputSchema: z.union([
    z.object({
      resolved: z.literal(true),
      intent: z.string().describe('Resolved intent id, e.g. "cancel-user"'),
      targetQuery: z.string().describe('The user the request targets'),
      resourceQuery: z.string().optional().describe('Target resource for appointment changes'),
      period: z.string().optional().describe('Optional period filter'),
      status: z.string().optional().describe('Optional status filter'),
    }),
    z.object({
      resolved: z.literal(false),
      unclear: z.string().describe('Why the request could not be resolved'),
    }),
  ]),
  execute: async ({ message }) => {
    let result = await classifyWithAgent(await resolveWorkflowAgent(), message)
    if ('unclear' in result) {
      return { resolved: false as const, unclear: result.unclear }
    }
    return {
      resolved: true as const,
      intent: result.intent,
      targetQuery: result.targetQuery,
      ...(result.resourceQuery ? { resourceQuery: result.resourceQuery } : {}),
      ...(result.period ? { period: result.period } : {}),
      ...(result.status ? { status: result.status } : {}),
    }
  },
})
