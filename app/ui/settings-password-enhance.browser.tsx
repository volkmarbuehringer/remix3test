import type { Handle } from 'remix/ui'
import { getCspNonce } from '../middleware/security-headers.ts'

/**
 * Client-side UX enhancement for the "Passwort ändern" panel on /settings.
 * Renders a single CSP-nonce'd inline <script> that:
 *
 *   1. Adds a live "passwords match" indicator under the confirm field.
 *   2. Sets `data-match="ok" | "bad"` on that indicator so it can be styled
 *      via the theme tokens (see matchFeedbackCss in the settings controller).
 *   3. Moves focus to the error banner when the server re-renders after a
 *      failed submit (full-page navigation resets focus to the document).
 *
 * This is progressive enhancement: without JS, the form still works and the
 * existing `passwordComplexityScript` server validation remains authoritative.
 */
export function SettingsPasswordEnhance(_handle: Handle) {
  let nonce = getCspNonce()
  return () => <script nonce={nonce}>{SCRIPT}</script>
}

const SCRIPT = `
(function () {
  function run() {
    var panel = document.querySelector('[data-settings-panel]');
    if (!panel) return;

    var newPw = panel.querySelector('[name="newPassword"]');
    var confirm = panel.querySelector('[name="confirmPassword"]');
    var hint = panel.querySelector('[data-pw-match]');
    if (!confirm || !hint) return;

    function update() {
      if (confirm.value.length === 0) {
        hint.textContent = '';
        hint.removeAttribute('data-match');
        return;
      }
      if (newPw && confirm.value === newPw.value) {
        hint.textContent = 'Passwörter stimmen überein';
        hint.setAttribute('data-match', 'ok');
      } else {
        hint.textContent = 'Passwörter stimmen nicht überein';
        hint.setAttribute('data-match', 'bad');
      }
    }

    confirm.addEventListener('input', update);
    if (newPw) newPw.addEventListener('input', update);
    update();

    // After a failed submit the server re-renders the panel with an error
    // banner, but a full-page navigation resets focus to <body> — move focus
    // to the alert so keyboard + screen-reader users land on the message.
    var alert = panel.querySelector('[data-settings-alert]');
    if (alert) {
      alert.setAttribute('tabindex', '-1');
      alert.focus();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
`
