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

  // Admin — offerings
  // Note: config and week are POST-only action endpoints (not navigable pages),
  // included here for completeness if they appear as frame navigation targets.
  '/admin/offerings': 'Leistungen',
  '/admin/offerings/config': 'Konfiguration',
  '/admin/offerings/week': 'Wochenansicht',

  // Admin — appointments
  '/admin/appointments': 'Termine',
  '/admin/appointments/events': 'Termine',

  // Admin — users
  '/admin/users': 'Users',

  // Admin — resources
  '/admin/resources': 'Resources',

  // Admin — offering configs
  '/admin/offering-configs': 'Offering Configs',

  // Client Lab
  '/client': 'Client Lab',
  '/client/grid': 'Grid',
  '/client/edit': 'Edit',
  '/client/create': 'Create',
}
