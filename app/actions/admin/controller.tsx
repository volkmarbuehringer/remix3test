export { default as adminController } from './dashboard/controller.tsx'
export { adminChatlog, adminChatlogFragments } from './chatlog/controller.tsx'
export { default as adminMessages } from './messages/controller.tsx'
export { default as adminFragments } from './fragments/controller.tsx'
export { default as adminLists } from './lists/controller.tsx'
export { default as adminUsers } from './users/controller.tsx'

// Flat admin-route groups re-exported through the single admin entry point.
export { default as adminNutzer } from '../nutzer/controller.tsx'
export { default as adminClient } from '../client/controller.tsx'
export { workflowAgent } from '../workflow-agent/controller.tsx'
export { default as agentEvents } from '../agent-events/controller.tsx'
// `mastra/` is the agent subsystem; its controller stays coupled there.
export { default as supportAgent } from './support-agent/controller.tsx'
