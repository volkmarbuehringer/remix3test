import { createController } from 'remix/router'
import { aiRoutes as routes } from '../../routes.ts'
import type { AppContext } from '../../types/context.ts'
import { requireAuth } from '../../middleware/auth.ts'
import { fragmentResponseInit } from '../../middleware/render.tsx'
import { AgentResultFragment } from '../../ui/ai-fragments/agent-result-fragment.tsx'

/**
 * Controller for AI fragment endpoints used by client-mounted frames.
 */
export default createController<typeof routes.ai.fragments, AppContext>(
  routes.ai.fragments,
  {
    middleware: [requireAuth()],

    actions: {
      async agentResult(context) {
        // Brief delay so the frame fallback is visible
        await delay(100)

        let prompt = context.url.searchParams.get('prompt') ?? 'No prompt provided'

        // Generate a simulated agent response
        let now = new Date()
        let result = {
          prompt,
          response: `Processed at ${now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}. The agent analyzed "${prompt.substring(0, 50)}" and generated a response.`,
          executionTime: `${(Math.random() * 2 + 0.5).toFixed(1)}s`,
          steps: [
            { name: 'analyze', status: 'complete', duration: '0.3s' },
            { name: 'process', status: 'complete', duration: '0.5s' },
            { name: 'format', status: 'complete', duration: '0.1s' },
          ],
        }

        return context.render(
          <AgentResultFragment result={result} />,
          fragmentResponseInit(),
        )
      },
    },
  },
)

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
