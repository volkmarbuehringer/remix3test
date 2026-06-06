import { registerWorkflow } from '../registry.ts'
import type { Workflow } from '../types.ts'

const createPurchaseOrderWorkflow: Workflow = async function* (context, params) {
  let { logger } = context
  let booksParam = params.books as Array<{ id: number; title: string; author: string }>
  let analysis = params.analysis as string

  if (!booksParam || booksParam.length === 0) {
    return { message: 'No books to order', orderId: undefined }
  }

  yield { id: 'create', name: 'Creating purchase order', status: 'running' }

  logger.log('Creating purchase order for', booksParam.length, 'books')

  let orderId = 'PO-' + Date.now()

  yield {
    id: 'create',
    name: 'Creating purchase order',
    status: 'completed',
    output: { bookCount: booksParam.length, orderId },
  }

  yield { id: 'notify', name: 'Sending notification', status: 'running' }

  yield {
    id: 'notify',
    name: 'Sending notification',
    status: 'completed',
    output: { sent: true },
  }

  return {
    orderId,
    booksOrdered: booksParam.length,
  }
}

registerWorkflow({
  id: 'create-purchase-order',
  name: 'Create Purchase Order',
  description: 'Create a purchase order for restocked books',
  parameters: [
    { name: 'books', type: 'string', required: true, description: 'Books to order (JSON array)' },
    { name: 'analysis', type: 'string', required: false, description: 'LLM analysis' },
  ],
  run: createPurchaseOrderWorkflow,
})
