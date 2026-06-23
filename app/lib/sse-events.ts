import { createChannel } from './sse.ts'

export const webhookChannel = createChannel<{
  new_request: void
}>({ heartbeatMs: 30_000 })
