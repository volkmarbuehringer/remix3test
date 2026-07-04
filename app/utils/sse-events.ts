import { createChannel } from './sse.ts'

export const webhookChannel = createChannel<{
  invalidate: void
}>({ heartbeatMs: 30_000 })
