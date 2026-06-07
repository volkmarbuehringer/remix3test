import { routes } from './routes.ts'

export const ROUTE_LABELS: Record<string, string> = {
  [routes.home.href()]: 'Home',

  // Auth
  [routes.auth.login.index.href()]: 'Login',
  [routes.auth.register.index.href()]: 'Register',

  // AI
  [routes.ai.index.href()]: 'AI Dashboard',
  [routes.ai.chat.index.href()]: 'Chat',
  [routes.ai.agent.index.href()]: 'Agent',
  [routes.ai.workflow.index.href()]: 'Workflows',
  [routes.ai.fragments.agentResult.href()]: 'Agent Result',

  // Admin
  [routes.admin.index.href()]: 'Admin Dashboard',
  [routes.admin.chatlog.index.href()]: 'Chat Logs',
  '/admin/chatlog/fragments/detail': 'Conversation Detail',
  [routes.admin.messages.index.href()]: 'Messages',
  [routes.admin.lists.index.href()]: 'Lists',
  [routes.admin.fragments.stats.href()]: 'Stats',
  [routes.admin.fragments.recentActivity.href()]: 'Recent Activity',
  '/admin/fragments/user-detail': 'User Detail',
  [routes.admin.users.index.href()]: 'Users',

  // Verwaltung
  [routes.verwaltung.index.href()]: 'Verwaltung',
  [routes.verwaltung.offerings.index.href()]: 'Angebote',
  [routes.verwaltung.offerings.configSave.href()]: 'Konfiguration',
  [routes.verwaltung.offerings.weekGenerate.href()]: 'Wochenansicht',
  [routes.verwaltung.appointments.index.href()]: 'Termine',
  [routes.verwaltung.appointments.events.href()]: 'Termine',
  [routes.verwaltung.resources.index.href()]: 'Ressourcen',
  [routes.verwaltung.offeringConfigs.index.href()]: 'Angebotskonfigurationen',

  // UI showcase
  [routes.ui.href()]: 'UI Showcase',
  '/ui/button': 'Button',
  '/ui/form': 'Form',
  '/ui/theme': 'Theme Tokens',

  // Lists
  [routes.lists.index.href()]: 'Lists',
  [routes.lists.save.href()]: 'Save',

  // Appointment
  [routes.appointment.index.href()]: 'Terminbuchung',
  [routes.appointment.events.href()]: 'Termine',
  [routes.appointment.types.index.href()]: 'Termintypen',

  // Nutzer
  [routes.nutzer.index.href()]: 'Nutzer',

  // Client
  [routes.client.index.href()]: 'Client Lab',
  [routes.client.grid.href()]: 'Grid',
  '/client/edit': 'Edit',
  [routes.client.create.href()]: 'Create',
}
