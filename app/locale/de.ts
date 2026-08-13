import { html } from 'remix/html-template'

export const email = {
  verification: {
    subject: 'Bestätigen Sie Ihre E-Mail-Adresse',
    html(name: string, url: string) {
      return String(html`
        <h1>Bestätigen Sie Ihre E-Mail-Adresse</h1>
        <p>Hallo ${name},</p>
        <p>
          vielen Dank für die Erstellung Ihres Kontos! Bitte bestätigen Sie Ihre E-Mail-Adresse,
          indem Sie auf den folgenden Link klicken:
        </p>
        <p><a href="${url}">${url}</a></p>
        <p>Dieser Link läuft in 24 Stunden ab.</p>
        <p>Falls Sie dieses Konto nicht erstellt haben, können Sie diese E-Mail ignorieren.</p>
      `)
    },
    text(name: string, url: string) {
      return [
        'Bestätigen Sie Ihre E-Mail-Adresse',
        '',
        `Hallo ${name},`,
        '',
        'vielen Dank für die Erstellung Ihres Kontos! Bitte bestätigen Sie Ihre E-Mail-Adresse, indem Sie den folgenden Link aufrufen:',
        '',
        url,
        '',
        'Dieser Link läuft in 24 Stunden ab.',
        '',
        'Falls Sie dieses Konto nicht erstellt haben, können Sie diese E-Mail ignorieren.',
      ].join('\n')
    },
  },
  passwordReset: {
    subject: 'Passwort zurücksetzen',
    html(name: string, url: string) {
      return String(html`
        <h1>Passwort zurücksetzen</h1>
        <p>Hallo ${name},</p>
        <p>
          wir haben eine Anfrage zum Zurücksetzen Ihres Passworts erhalten. Klicken Sie auf den
          folgenden Link, um ein neues Passwort zu vergeben:
        </p>
        <p><a href="${url}">${url}</a></p>
        <p>Dieser Link läuft in 1 Stunde ab.</p>
        <p>Falls Sie kein neues Passwort angefordert haben, können Sie diese E-Mail ignorieren.</p>
      `)
    },
    text(name: string, url: string) {
      return [
        'Passwort zurücksetzen',
        '',
        `Hallo ${name},`,
        '',
        'wir haben eine Anfrage zum Zurücksetzen Ihres Passworts erhalten. Rufen Sie den folgenden Link auf, um ein neues Passwort zu vergeben:',
        '',
        url,
        '',
        'Dieser Link läuft in 1 Stunde ab.',
        '',
        'Falls Sie kein neues Passwort angefordert haben, können Sie diese E-Mail ignorieren.',
      ].join('\n')
    },
  },
  accountDeletion: {
    subject: 'Ihr Konto wurde gelöscht',
    self: {
      html(name: string) {
        return String(html`
          <h1>Ihr Konto wurde gelöscht</h1>
          <p>Hallo ${name},</p>
          <p>
            Ihr Konto wurde erfolgreich gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
          </p>
          <p>
            Wenn Sie Fragen haben oder Hilfe benötigen, wenden Sie sich bitte an unseren Support.
          </p>
        `)
      },
      text(name: string) {
        return [
          'Ihr Konto wurde gelöscht',
          '',
          `Hallo ${name},`,
          '',
          'Ihr Konto wurde erfolgreich gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.',
          '',
          'Wenn Sie Fragen haben oder Hilfe benötigen, wenden Sie sich bitte an unseren Support.',
        ].join('\n')
      },
    },
    admin: {
      html(name: string) {
        return String(html`
          <h1>Ihr Konto wurde gelöscht</h1>
          <p>Hallo ${name},</p>
          <p>Ihr Konto wurde von einem Administrator gelöscht.</p>
          <p>
            Wenn Sie Fragen haben oder Hilfe benötigen, wenden Sie sich bitte an unseren Support.
          </p>
        `)
      },
      text(name: string) {
        return [
          'Ihr Konto wurde gelöscht',
          '',
          `Hallo ${name},`,
          '',
          'Ihr Konto wurde von einem Administrator gelöscht.',
          '',
          'Wenn Sie Fragen haben oder Hilfe benötigen, wenden Sie sich bitte an unseren Support.',
        ].join('\n')
      },
    },
  },
}
