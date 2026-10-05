import type { Handle } from 'remix/component'
import { getCspNonce } from '../middleware/security-headers.ts'

import { PASSWORD_TOGGLE_SCRIPT } from './password-toggle.script.ts'

export function PasswordToggle(_handle: Handle) {
  let nonce = getCspNonce()
  return () => <script nonce={nonce}>{PASSWORD_TOGGLE_SCRIPT}</script>
}

export { PASSWORD_TOGGLE_SCRIPT }
