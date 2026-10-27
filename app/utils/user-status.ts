/**
 * Status filter shared by the admin users grid and its hidden grid-state
 * fields. Kept outside the controller so the page component can type its
 * `status` prop without importing server code.
 */
export type UserStatus = 'enabled' | 'disabled'

/** Whitelist a status value from a query param or a hidden form field. */
export function parseUserStatus(value: string | null | undefined): UserStatus | undefined {
  return value === 'enabled' || value === 'disabled' ? value : undefined
}
