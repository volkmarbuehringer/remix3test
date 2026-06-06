import type { MiddlewareContext } from 'remix/router'

import type { createNewappMiddleware } from '../middleware/root.ts'

export type AppContext = MiddlewareContext<ReturnType<typeof createNewappMiddleware>>
