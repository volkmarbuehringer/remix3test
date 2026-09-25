export { default as adminController } from './dashboard/controller.tsx'
export { adminChatlog } from './chatlog/controller.tsx'
export { default as adminChatlogFragments } from './chatlog/fragments/controller.tsx'
export { default as adminMessages } from './messages/controller.tsx'
export { default as adminFragments } from './fragments/controller.tsx'
export { default as adminLists } from './lists/controller.tsx'
export { default as adminUsers } from './users/controller.tsx'
export { default as adminUploads } from './uploads/controller.tsx'
export { webhookRequests as adminWebhookRequests } from './webhook-requests/controller.tsx'
export { default as adminWebhookRequestsEvents } from './webhook-requests/events/controller.tsx'
export { default as adminWebhookRequestsCreate } from './webhook-requests/create/controller.tsx'

// Flat admin-route groups re-exported through their doctor entry points, which
// in turn re-export the colocated top-level controllers.
export { default as adminClients } from './clients/controller.tsx'
export { default as agentEvents } from './agent-events/controller.tsx'
export { default as supportAgent } from './support-agent/controller.tsx'
