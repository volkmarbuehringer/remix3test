import { createChannel } from './sse.ts'

export const webhookChannel = createChannel<{
  new_request: void
  callback_received: void
}>({ heartbeatMs: 30_000 })
