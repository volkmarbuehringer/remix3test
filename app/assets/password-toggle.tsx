import type { Handle } from 'remix/ui'
import { getCspNonce } from '../middleware/security-headers.ts'

export function PasswordToggle(_handle: Handle) {
  let nonce = getCspNonce()
  return () => (
    <script nonce={nonce}>{PASSWORD_TOGGLE_SCRIPT}</script>
  )
}

const PASSWORD_TOGGLE_SCRIPT = `
document.addEventListener('click', function(e) {
  var btn = e.target.closest('[data-toggle-pw]');
  if (!btn) return;
  var fieldName = btn.getAttribute('data-toggle-pw');
  if (!fieldName) return;
  var form = btn.closest('form');
  if (!form) return;
  var input = form.querySelector('[name="' + fieldName + '"]');
  if (!input) return;
  var isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';
  var useEl = btn.querySelector('use');
  if (useEl) {
    var ref = isPassword ? '#rmx-glyph-eyeOff' : '#rmx-glyph-eye';
    useEl.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', ref);
    useEl.setAttribute('href', ref);
  }
  btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
});
`
