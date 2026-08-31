import { routes } from './routes.ts'

function routeParentPath(route: { pattern: { source: string } }): string {
  return route.pattern.source.replace(/\/[:*][^/]*$/, '/')
}

export const ROUTE_LABELS: Record<string, string> = {
  [routes.home.href()]: 'Home',

  // Auth
  [routes.auth.login.index.href()]: 'Login',
  [routes.auth.register.index.href()]: 'Register',

  // Settings
  [routes.settings.index.href()]: 'Einstellungen',

  // Support-Agent
  [routes.admin.supportAgent.index.href()]: 'KI Chat',

  // Agent Events (experimental pipeline)
  [routes.admin.agentEvents.index.href()]: 'Agent-Events',

  // Admin
  [routes.admin.index.href()]: 'Admin Dashboard',
  [routes.admin.chatlog.index.href()]: 'Chat Logs',
  [routes.admin.messages.index.href()]: 'Messages',
  [routes.admin.lists.index.href()]: 'Lists',
  [routes.admin.fragments.stats.href()]: 'Stats',
  [routes.admin.fragments.recentActivity.href()]: 'Recent Activity',
  [routeParentPath(routes.admin.fragments.userDetail)]: 'User Detail',
  [routes.admin.users.index.href()]: 'Users',
  [routes.admin.uploads.index.href()]: 'Uploads',

  // Verwaltung
  [routes.verwaltung.index.href()]: 'Verwaltung',
  [routes.verwaltung.appointments.events.href()]: 'Termine',
  [routes.verwaltung.appointments.index.href()]: 'Termine',
  [routes.verwaltung.offeringConfigs.index.href()]: 'Angebotskonfigurationen',
  [routes.verwaltung.offerings.configSave.href()]: 'Konfiguration',
  [routes.verwaltung.offerings.index.href()]: 'Angebote',
  [routes.verwaltung.offerings.weekGenerate.href()]: 'Wochenansicht',
  [routes.verwaltung.pdf.index.href()]: 'PDF-Export',
  [routes.verwaltung.report1.index.href()]: 'Monatsauswertung',
  [routes.verwaltung.resources.index.href()]: 'Ressourcen',
  [routes.verwaltung.usersExport.index.href()]: 'Benutzer-Export',
  [routes.verwaltung.usersPdf.index.href()]: 'Benutzer-PDF',

  // Lists
  [routes.lists.index.href()]: 'Lists',

  // Appointment
  [routes.appointmentsNew.index.href()]: 'Neuer Termin',
  [routes.appointment.index.href()]: 'Terminbuchung',
  [routes.appointment.events.href()]: 'Termine',
  [routes.appointment.types.index.href()]: 'Termintypen',

  // Client
  [routes.admin.clients.index.href()]: 'Client',
  [routeParentPath(routes.admin.clients.edit)]: 'Edit',
  [routes.admin.clients.create.href()]: 'Create',
}
