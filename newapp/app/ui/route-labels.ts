/**
 * Centralized route-to-display-label mappings.
 * Single source of truth for breadcrumbs, nav labels, and other UI components.
 * When adding a new route, add its display label here.
 */

/**
 * Maps URL paths to their display labels.
 * The key is the canonical path (no trailing slash).
 * The value is the human-readable label shown in breadcrumbs and nav.
 */
export const ROUTE_LABELS: Record<string, string> = {
  // Root
  '/': 'Home',

  // Auth
  '/login': 'Login',
  '/register': 'Register',

  // AI section
  '/ai': 'AI Dashboard',
  '/ai/chat': 'Chat',
  '/ai/agent': 'Agent',
  '/ai/workflow': 'Workflows',
  '/ai/fragments/agent-result': 'Agent Result',

  // Admin section
  '/admin': 'Admin Dashboard',
  '/admin/chatlog': 'Chat Logs',
  '/admin/chatlog/fragments/detail': 'Conversation Detail',
  '/admin/messages': 'Messages',
  '/admin/lists': 'Lists',
  '/admin/fragments/stats': 'Stats',
  '/admin/fragments/recent-activity': 'Recent Activity',
  '/admin/fragments/user-detail': 'User Detail',
  '/admin/users': 'Users',

  // Verwaltung section (operational data management)
  '/verwaltung': 'Verwaltung',
  '/verwaltung/offerings': 'Angebote',
  '/verwaltung/offerings/config': 'Konfiguration',
  '/verwaltung/offerings/week': 'Wochenansicht',
  '/verwaltung/appointments': 'Termine',
  '/verwaltung/appointments/events': 'Termine',
  '/verwaltung/resources': 'Ressourcen',
  '/verwaltung/offering-configs': 'Angebotskonfigurationen',

  // UI showcase
  '/ui': 'UI Showcase',
  '/ui/button': 'Button',
  '/ui/form': 'Form',
  '/ui/theme': 'Theme Tokens',

  // Lists
  '/lists': 'Lists',
  '/lists/save': 'Save',
  '/lists/:id': 'Item Details',
  '/lists/:id/data': 'Data',

  // Appointment section
  '/appointment': 'Terminbuchung',
  '/appointment/events': 'Termine',
  '/appointment/types': 'Termintypen',

  // Nutzer
  '/nutzer': 'Nutzer',

  // Client Lab
  '/client': 'Client Lab',
  '/client/grid': 'Grid',
  '/client/edit': 'Edit',
  '/client/create': 'Create',
}
