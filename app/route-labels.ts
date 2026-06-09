import { routes } from './routes.ts'

function routeParentPath(route: {
  pattern: {
    pathname: {
      tokens: ReadonlyArray<{
        readonly type: string
        readonly text?: string
        readonly name?: string
      }>
    }
  }
}): string {
  let tokens = route.pattern.pathname.tokens
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i].type === ':' || tokens[i].type === '*') {
      let path = ''
      for (let j = 0; j < i; j++) {
        let t = tokens[j]
        if (t.type === 'text') path += t.text
        else if (t.type === 'separator') path += '/'
        else if (t.type === '(' || t.type === ')') path += t.type
      }
      return path
    }
  }
  return (route as any).href()
}

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
  [routes.admin.messages.index.href()]: 'Messages',
  [routes.admin.lists.index.href()]: 'Lists',
  [routes.admin.fragments.stats.href()]: 'Stats',
  [routes.admin.fragments.recentActivity.href()]: 'Recent Activity',
  [routeParentPath(routes.admin.fragments.userDetail)]: 'User Detail',
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
  [routes.uiComponent.href({ component: 'button' })]: 'Button',
  [routes.uiComponent.href({ component: 'form' })]: 'Form',
  [routes.uiComponent.href({ component: 'theme' })]: 'Theme Tokens',

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
  [routeParentPath(routes.client.edit)]: 'Edit',
  [routes.client.create.href()]: 'Create',
}
