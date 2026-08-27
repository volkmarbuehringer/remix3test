export const INTENTS = {
  CANCEL_USER: 'cancel-user',
  LOCK_USER: 'lock-user',
  UNLOCK_USER: 'unlock-user',
  SHOW_APPOINTMENTS: 'show-appointments',
  DELETE_APPOINTMENTS: 'delete-appointments',
} as const

export const INTENT_TO_ACTION: Record<string, string> = {
  [INTENTS.CANCEL_USER]: 'cancel',
  [INTENTS.LOCK_USER]: 'lock',
  [INTENTS.UNLOCK_USER]: 'unlock',
  [INTENTS.DELETE_APPOINTMENTS]: 'delete-resource',
}
