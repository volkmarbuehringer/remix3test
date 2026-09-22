import { css } from 'remix/ui'
import type { Handle, RemixNode } from 'remix/ui'

import { Document } from './document.tsx'
import { MainNav } from './main-nav.tsx'
import { theme } from './theme/theme.ts'

// NOTE: These are structural templates. Replace every [bracketed] placeholder
// with the operator's real details before the site is publicly reachable — an
// Impressum with placeholder text is not a valid Anbieterkennzeichnung.

interface LegalShellProps {
  title: string
  description: string
  children?: RemixNode
}

function LegalShell(handle: Handle<LegalShellProps>) {
  return () => {
    let { title, description, children } = handle.props
    return (
      <Document title={`${title} – newapp`} description={description}>
        <MainNav />
        <main mix={mainCss}>
          <h1 mix={h1Css}>{title}</h1>
          {children}
        </main>
      </Document>
    )
  }
}

export function ImpressumPage() {
  return () => (
    <LegalShell
      title="Impressum"
      description="Impressum und Anbieterkennzeichnung von newapp gemäß § 5 DDG."
    >
      <p mix={pCss}>Angaben gemäß § 5 DDG</p>
      <address mix={addressCss}>
        [Firmenname] [Rechtsform]
        <br />
        [Straße Hausnummer]
        <br />
        [PLZ Ort]
        <br />
        [Land]
      </address>

      <h2 mix={h2Css}>Vertreten durch</h2>
      <p mix={pCss}>[Vor- und Nachname der vertretungsberechtigten Person]</p>

      <h2 mix={h2Css}>Kontakt</h2>
      <p mix={pCss}>
        Telefon: [Telefonnummer]
        <br />
        E-Mail: [E-Mail-Adresse]
      </p>

      <h2 mix={h2Css}>Registereintrag</h2>
      <p mix={pCss}>
        Eintragung im Handelsregister
        <br />
        Registergericht: [Amtsgericht]
        <br />
        Registernummer: [HRB-Nummer]
      </p>

      <h2 mix={h2Css}>Umsatzsteuer-ID</h2>
      <p mix={pCss}>
        Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz: [USt-IdNr.]
      </p>

      <h2 mix={h2Css}>Verantwortlich für den Inhalt</h2>
      <p mix={pCss}>
        Verantwortlich für journalistisch-redaktionelle Inhalte gemäß § 18 Abs. 2 MStV:
        <br />
        [Vor- und Nachname], [Anschrift]
      </p>
    </LegalShell>
  )
}

export function DatenschutzPage() {
  return () => (
    <LegalShell
      title="Datenschutzerklärung"
      description="Informationen zur Verarbeitung personenbezogener Daten bei newapp."
    >
      <h2 mix={h2Css}>1. Verantwortlicher</h2>
      <p mix={pCss}>
        Verantwortlich für die Datenverarbeitung auf dieser Website ist:
        <br />
        [Firmenname], [Anschrift], [E-Mail-Adresse].
      </p>

      <h2 mix={h2Css}>2. Hosting</h2>
      <p mix={pCss}>
        Die Anwendung wird auf Servern innerhalb der Europäischen Union betrieben. Schriften und
        Skripte werden ausschließlich von diesem Server geladen; es findet keine Einbindung von
        Schrift- oder Analysediensten Dritter statt. Beim Aufruf der Seiten verarbeitet der Server
        technisch notwendige Zugriffsdaten (z.&nbsp;B. IP-Adresse, Zeitpunkt, angeforderte
        Ressource) zur Sicherstellung des Betriebs und der Sicherheit.
      </p>

      <h2 mix={h2Css}>3. Verarbeitete Daten und Zwecke</h2>
      <p mix={pCss}>
        Bei der Registrierung und Nutzung verarbeiten wir die von Ihnen angegebenen Konto- und
        Termindaten, um den Dienst bereitzustellen. Rechtsgrundlagen sind Art. 6 Abs. 1 lit. b DSGVO
        (Vertragserfüllung) sowie Art. 6 Abs. 1 lit. f DSGVO (sicherer, stabiler Betrieb).
      </p>

      <h2 mix={h2Css}>4. Speicherdauer</h2>
      <p mix={pCss}>
        Wir speichern personenbezogene Daten nur so lange, wie es für die genannten Zwecke
        erforderlich ist oder gesetzliche Aufbewahrungsfristen bestehen.
      </p>

      <h2 mix={h2Css}>5. Ihre Rechte</h2>
      <p mix={pCss}>
        Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
        Datenübertragbarkeit sowie Widerspruch. Außerdem können Sie sich bei einer
        Datenschutz-Aufsichtsbehörde beschweren. Wenden Sie sich dazu an die oben genannte
        verantwortliche Stelle.
      </p>
    </LegalShell>
  )
}

const mainCss = css({
  flex: 1,
  width: '100%',
  maxWidth: '720px',
  margin: '0 auto',
  padding: `${theme.space.xxl} ${theme.space.lg}`,
  boxSizing: 'border-box',
  color: theme.colors.text.primary,
})

const h1Css = css({
  fontSize: theme.fontSize.xxl,
  fontWeight: theme.fontWeight.bold,
  lineHeight: theme.lineHeight.tight,
  marginBottom: theme.space.lg,
})

const h2Css = css({
  fontSize: theme.fontSize.lg,
  fontWeight: theme.fontWeight.semibold,
  marginTop: theme.space.xl,
  marginBottom: theme.space.sm,
})

const pCss = css({
  margin: `0 0 ${theme.space.md}`,
  fontSize: theme.fontSize.md,
  lineHeight: theme.lineHeight.relaxed,
  color: theme.colors.text.secondary,
})

const addressCss = css({
  fontStyle: 'normal',
  fontSize: theme.fontSize.md,
  lineHeight: theme.lineHeight.relaxed,
  color: theme.colors.text.secondary,
})
