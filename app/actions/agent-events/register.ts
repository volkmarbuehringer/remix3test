import type { EventBus } from './event-bus.ts'
import { validateHandler } from './handlers/validate.ts'
import { classifyHandler } from './handlers/classify.ts'
import { resolveHandler } from './handlers/resolve.ts'
import { dispatchHandler } from './handlers/dispatch.ts'
import { confirmHandler } from './handlers/confirm.ts'
import { executeHandler } from './handlers/execute.ts'
import { finalizeHandler } from './handlers/finalize.ts'

export function registerHandlers(bus: EventBus): void {
  bus.register(validateHandler)
  bus.register(classifyHandler)
  bus.register(resolveHandler)
  bus.register(dispatchHandler)
  bus.register(confirmHandler)
  bus.register(executeHandler)
  bus.register(finalizeHandler)
}
