import { registerWorkflow } from '../registry.ts'
import { restockAnalysisDefinition } from './restock-analysis.ts'
import { trendingReportDefinition } from './trending-report.ts'
import { createPurchaseOrderDefinition } from './create-purchase-order.ts'

let registered = false

export function registerWorkflows(): void {
  // Idempotent: safe to call multiple times (e.g. in tests that construct
  // fresh routers) — only first invocation registers definitions.
  if (registered) return
  registered = true

  registerWorkflow(restockAnalysisDefinition)
  registerWorkflow(trendingReportDefinition)
  registerWorkflow(createPurchaseOrderDefinition)

}
