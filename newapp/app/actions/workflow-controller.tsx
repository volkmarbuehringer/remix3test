import { createController } from 'remix/router'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { sql } from 'remix/data-table'

import { aiRoutes as routes } from '../routes.ts'
import type { AppContext } from '../types/context.ts'
import { requireAuth } from '../middleware/auth.ts'
import type { User } from '../data/schema.ts'
import { listWorkflows, getWorkflow } from '../workflows/registry.ts'
import { createWorkflowRun, executeWorkflow, getWorkflowRun, listWorkflowRuns } from '../workflows/engine.ts'
import { renderAiPage } from '../ui/ai-layout.tsx'
import { WorkflowPage } from '../ui/workflow-page.tsx'
import { WorkflowRunPage } from '../ui/workflow-run-page.tsx'
import { userLogger } from '../utils/logger.ts'

const workflowSchema = f.object({
  workflowId: f.field(s.string()),
})

export default createController<typeof routes.ai.workflow, AppContext>(routes.ai.workflow, {
  middleware: [requireAuth()],

  actions: {
    async index(context) {
      let logger = userLogger('Workflow')

      logger.log('GET index:', { hasDb: !!context.db, hasAuth: !!context.auth, authOk: context.auth?.ok })

      let runId = context.url.searchParams.get('runId')

      if (runId) {
        let run = await getWorkflowRun(context.db, runId)
        if (!run) {
          return renderAiPage(context.render, 'workflow', <WorkflowRunPage error="Workflow run not found" />)
        }

        return renderAiPage(context.render, 'workflow', <WorkflowRunPage run={run} />)
      }

      let workflows = listWorkflows()
      let recentRuns = await listWorkflowRuns(context.db, 20)

      logger.log('loaded', { workflows: workflows.length, runs: recentRuns.length })

      return renderAiPage(context.render, 'workflow', <WorkflowPage workflows={workflows} recentRuns={recentRuns} />)
    },

    async action(context) {
      let logger = userLogger('Workflow')
      let db = context.db
      let auth = context.auth
      let formData = context.formData

      logger.log('POST action:', {
        hasDb: !!db, hasAuth: !!auth, authOk: auth?.ok,
        formEntries: Array.from(formData.entries()).length
      })

      let workflowId: string
      try {
        ({ workflowId } = s.parse(workflowSchema, formData))
      } catch {
        return new Response(JSON.stringify({ error: 'Workflow ID is required' }), {
          status: 400, headers: { 'Content-Type': 'application/json' },
        })
      }

      let workflow = getWorkflow(workflowId)
      if (!workflow) {
        logger.log('workflow not found:', workflowId)
        return new Response(JSON.stringify({ error: 'Workflow not found' }), {
          status: 404, headers: { 'Content-Type': 'application/json' },
        })
      }

      let params: Record<string, unknown> = {}
      for (let param of (workflow.parameters ?? [])) {
        let value = formData.get(param.name)?.toString()
        if (value) {
          if (param.type === 'number') params[param.name] = Number(value)
          else if (param.type === 'boolean') params[param.name] = value === 'true'
          else params[param.name] = value
        }
      }

      logger.log('parsed params:', params)

      let userId = auth?.ok ? (auth.identity as { id: number }).id : null
      let runId = await createWorkflowRun(db, workflowId, params, userId)

      logger.log('created run:', { runId, workflowId, userId })

      // executeWorkflow has internal error handling; this outer catch
      // is a safety net for unexpected failures before the engine's try block
      executeWorkflow(runId, {
        workflowId, params, db,
        user: auth?.ok ? (auth.identity as User) : null,
        logger,
      }).catch(async error => {
        let errorMessage = error instanceof Error ? error.message : String(error)
        logger.error('execution failed:', errorMessage)
        await db.exec(sql`UPDATE workflow_runs SET status = 'failed', error = ${errorMessage}, completed_at = ${Date.now()} WHERE id = ${runId}`)
      })

      let redirectUrl = routes.ai.workflow.index.href()
      return new Response(null, {
        status: 303,
        headers: { Location: `${redirectUrl}?runId=${runId}` },
      })
    },
  },
})
