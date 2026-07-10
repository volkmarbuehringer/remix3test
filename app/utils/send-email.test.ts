import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendAccountDeletionEmail,
} from './send-email.ts'
import type { SendEmailFn, SendEmailOptions } from './send-email.ts'

function createMockSendEmail(): { fn: SendEmailFn; calls: Array<SendEmailOptions> } {
  let calls: Array<SendEmailOptions> = []
  let fn: SendEmailFn = async (opts) => {
    calls.push(opts)
  }
  return { fn, calls }
}

describe('sendVerificationEmail', () => {
  it('sends with German subject and content', async () => {
    let { fn, calls } = createMockSendEmail()
    await sendVerificationEmail(
      fn,
      { name: 'Max', email: 'max@example.com' },
      'https://example.com/verify/token123',
    )

    assert.equal(calls.length, 1)
    let email = calls[0]
    assert.equal(email.to, 'max@example.com')
    assert.equal(email.subject, 'Bestätigen Sie Ihre E-Mail-Adresse')

    let html = email.html as string
    assert.ok(html.includes('Bestätigen Sie Ihre E-Mail-Adresse'))
    assert.ok(html.includes('Hallo Max'))
    assert.ok(html.includes('https://example.com/verify/token123'))
    assert.ok(html.includes('24 Stunden'))

    let text = email.text as string
    assert.ok(text.includes('Bestätigen Sie Ihre E-Mail-Adresse'))
    assert.ok(text.includes('Hallo Max'))
    assert.ok(text.includes('24 Stunden'))
  })
})

describe('sendPasswordResetEmail', () => {
  it('sends with German subject and content', async () => {
    let { fn, calls } = createMockSendEmail()
    await sendPasswordResetEmail(
      fn,
      { name: 'Anna', email: 'anna@example.com' },
      'https://example.com/reset/token456',
    )

    assert.equal(calls.length, 1)
    let email = calls[0]
    assert.equal(email.to, 'anna@example.com')
    assert.equal(email.subject, 'Passwort zurücksetzen')

    let html = email.html as string
    assert.ok(html.includes('Passwort zurücksetzen'))
    assert.ok(html.includes('Hallo Anna'))
    assert.ok(html.includes('https://example.com/reset/token456'))
    assert.ok(html.includes('1 Stunde'))

    let text = email.text as string
    assert.ok(text.includes('Passwort zurücksetzen'))
    assert.ok(text.includes('Hallo Anna'))
    assert.ok(text.includes('1 Stunde'))
  })
})

describe('sendAccountDeletionEmail', () => {
  it('sends with German subject and self-deletion body', async () => {
    let { fn, calls } = createMockSendEmail()
    await sendAccountDeletionEmail(fn, { name: 'Max', email: 'max@example.com' }, 'self')

    assert.equal(calls.length, 1)
    let email = calls[0]
    assert.equal(email.to, 'max@example.com')
    assert.equal(email.subject, 'Ihr Konto wurde gelöscht')

    let html = email.html as string
    assert.ok(html.includes('Ihr Konto wurde gelöscht'))
    assert.ok(html.includes('Hallo Max'))
    assert.ok(html.includes('Konto wurde erfolgreich gelöscht'))
    assert.ok(html.includes('kann nicht rückgängig gemacht werden'))

    let text = email.text as string
    assert.ok(text.includes('Ihr Konto wurde gelöscht'))
    assert.ok(text.includes('Hallo Max'))
    assert.ok(text.includes('Konto wurde erfolgreich gelöscht'))
  })

  it('sends with admin-initiated deletion body', async () => {
    let { fn, calls } = createMockSendEmail()
    await sendAccountDeletionEmail(fn, { name: 'Anna', email: 'anna@example.com' }, 'admin')

    assert.equal(calls.length, 1)
    let email = calls[0]
    assert.equal(email.to, 'anna@example.com')
    assert.equal(email.subject, 'Ihr Konto wurde gelöscht')

    let html = email.html as string
    assert.ok(html.includes('Ihr Konto wurde gelöscht'))
    assert.ok(html.includes('Hallo Anna'))
    assert.ok(html.includes('von einem Administrator'))

    let text = email.text as string
    assert.ok(text.includes('von einem Administrator'))
  })
})

describe('HTML escaping', () => {
  it('escapes HTML characters in user name for HTML body', async () => {
    let { fn, calls } = createMockSendEmail()
    await sendVerificationEmail(
      fn,
      { name: '<b>Max</b>', email: 'max@example.com' },
      'https://example.com/verify/t',
    )

    let html = calls[0].html as string
    assert.ok(!html.includes('<b>Max</b>'), 'raw HTML should not appear in output')
    assert.ok(html.includes('&lt;b&gt;Max&lt;/b&gt;'), 'HTML entities should be escaped')
  })
})
