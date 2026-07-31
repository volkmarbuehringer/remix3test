import { css } from 'remix/ui'
import type { Handle } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'
import { Glyph } from '../ui/theme/glyph/glyph.tsx'
import { getCurrentUserSafely } from '../utils/context.ts'
import { routes } from '../routes.ts'
import { MainNav } from './main-nav.tsx'

const indigo = {
  50: '#eef2ff',
  100: '#e0e7ff',
  200: '#c7d2fe',
  300: '#a5b4fc',
  400: '#818cf8',
  500: '#6366f1',
  600: '#4f46e5',
  700: '#4338ca',
  800: '#3730a3',
  900: '#312e81',
}

const amber = '#f59e0b'
const emerald = '#10b981'
const rose = '#f43f5e'

function FontLoader() {
  return () => (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
      />
    </>
  )
}

function Keyframes() {
  return () => (
    <style>{`
      @keyframes fadeSlideUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
      @keyframes fadeSlideLeft { from{opacity:0;transform:translateX(40px)} to{opacity:1;transform:translateX(0)} }
      @keyframes fadeSlideRight { from{opacity:0;transform:translateX(-40px)} to{opacity:1;transform:translateX(0)} }
      @keyframes pulse-dim { 0%,100%{opacity:.6} 50%{opacity:1} }
      @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
      @keyframes gradientShift { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
      @keyframes revealWidth { from{width:0} to{width:100%} }
      @keyframes scaleIn { from{opacity:0;transform:scale(.8)} to{opacity:1;transform:scale(1)} }
    `}</style>
  )
}

export function HomePage() {
  return () => (
    <div mix={rootCss}>
      <FontLoader />
      <Keyframes />
      <MainNav />
      <div mix={scrollWrapperCss}>
        <div mix={scrollAreaCss}>
          <HeroSection />
          <ApproachSection />
          <CapabilitiesSection />
          <CtaSection />
        </div>
      </div>
      <MiniFooter />
    </div>
  )
}

function HeroSection() {
  return () => (
    <section mix={heroSectionCss}>
      <div mix={heroContentCss}>
        <div mix={heroLabelCss}>
          <span mix={heroLabelDotCss} />
          v2.0 — Grundlegend neu entwickelt
        </div>
        <h1 mix={heroTitleCss}>
          Verwaltung,
          <br />
          <span mix={heroTitleGradCss}>die begeistert</span>
        </h1>
        <div mix={heroDividerCss} />
        <p mix={heroDescCss}>
          openDesk vereint Terminplanung, Kundenmanagement und intelligente KI-Assistenz in einer
          Plattform, die dein Team lieben wird.
        </p>
        <div mix={heroBtnGroupCss}>
          <a href={routes.auth.register.index.href()} mix={heroBtnCss}>
            <span>30 Tage testen</span>
            <Glyph name="arrowRight" width={16} height={16} />
          </a>
        </div>
        <div mix={trustRowCss}>
          <div mix={trustAvatarsCss}>
            {[indigo[500], amber, emerald, rose].map((c, i) => (
              <div
                key={i}
                mix={trustAvatarCss}
                style={{ background: c, borderColor: theme.surface.lvl0 }}
              />
            ))}
          </div>
          <span mix={trustTextCss}>
            Von <strong>12+</strong> Teams vertraut
          </span>
        </div>
      </div>
      <div mix={heroVisualCss}>
        <div mix={heroVisualBgCss} />
        <div mix={heroMockupCss}>
          <div mix={mockupHeaderCss}>
            <div mix={mockupDotsCss}>
              <span mix={mockupDotCss} style={{ background: rose }} />
              <span mix={mockupDotCss} style={{ background: amber }} />
              <span mix={mockupDotCss} style={{ background: emerald }} />
            </div>
            <span mix={mockupTitleCss}>Dashboard</span>
          </div>
          <div mix={mockupBodyCss}>
            <StatBar label="Termine heute" value="8" color={indigo[500]} />
            <StatBar label="Offen" value="3" color={amber} />
            <StatBar label="Erledigt" value="5" color={emerald} />
            <div mix={mockupGridCss}>
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} mix={mockupCellCss} />
              ))}
            </div>
          </div>
        </div>
        <div mix={heroFloatingBadge1Css}>
          <Glyph name="check" width={14} height={14} style={{ color: emerald }} />
          KI-gestützt
        </div>
        <div mix={heroFloatingBadge2Css}>
          <Glyph name="calendar" width={14} height={14} style={{ color: indigo[500] }} />
          Termine sync
        </div>
      </div>
    </section>
  )
}

function StatBar(handle: Handle<{ label: string; value: string; color: string }>) {
  return () => {
    let { label, value, color } = handle.props
    return (
      <div mix={statBarRowCss}>
        <span mix={statBarLabelCss}>{label}</span>
        <div mix={statBarTrackCss}>
          <div
            mix={statBarFillCss}
            style={{ width: `${Number(value) * 10}%`, background: color }}
          />
        </div>
        <span mix={statBarValueCss} style={{ color }}>
          {value}
        </span>
      </div>
    )
  }
}

function ApproachSection() {
  return () => (
    <section mix={approachSectionCss}>
      <div mix={approachLabelCss}>Unsere Philosophie</div>
      <h2 mix={approachTitleCss}>
        Administration, die sich nach <span mix={approachHighlightCss}>Menschen</span> richtet
      </h2>
      <p mix={approachDescCss}>
        Nicht nach Tabellen. Wir haben die typische Verwaltungssoftware von Grund auf neu gedacht —
        mit Fokus auf Geschwindigkeit, Klarheit und einem Hauch von Freude.
      </p>
      <div mix={approachGridCss}>
        <div mix={approachCardCss}>
          <div mix={approachIconCss} style={{ background: `${indigo[100]}`, color: indigo[600] }}>
            <Glyph name="zap" width={20} height={20} />
          </div>
          <h3 mix={approachCardTitleCss}>Blitzschnell</h3>
          <p mix={approachCardDescCss}>
            Seitenwechsel ohne Neuladen. Keine Wartezeiten, keine Unterbrechungen.
          </p>
        </div>
        <div mix={approachCardCss}>
          <div mix={approachIconCss} style={{ background: `${emerald}15`, color: emerald }}>
            <Glyph name="shield" width={20} height={20} />
          </div>
          <h3 mix={approachCardTitleCss}>Sicher & DSGVO</h3>
          <p mix={approachCardDescCss}>
            Europäische Server, Ende-zu-Ende-Verschlüsselung, volle Kontrolle.
          </p>
        </div>
        <div mix={approachCardCss}>
          <div mix={approachIconCss} style={{ background: `${amber}15`, color: amber }}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
              <path d="M12 18V6" />
            </svg>
          </div>
          <h3 mix={approachCardTitleCss}>Fair Prepaid</h3>
          <p mix={approachCardDescCss}>
            Keine versteckten Kosten. Ein klarer Preis, alle Funktionen.
          </p>
        </div>
      </div>
    </section>
  )
}

function CapabilitiesSection() {
  return () => {
    let user = getCurrentUserSafely()
    let authHref = (path: string) => (user ? path : routes.auth.login.index.href())
    return (
      <section mix={capSectionCss}>
        <div mix={capGridCss}>
          <CapCard
            number="01"
            title="Terminplanung"
            desc="Intelligente Kalender mit Konflikterkennung, Wiederholungen und freien Slots."
            tags={['Kalender', 'Auto-Verteilung', 'Erinnerungen']}
            accent={indigo[500]}
            href={authHref(routes.appointment.index.href())}
          />
          <CapCard
            number="02"
            title="KI-Assistenz"
            desc="KI-Chat für schnelle Antworten, Datenabfragen und Support-Aufgaben."
            tags={['Chat', 'Wetter', 'Datenabfragen']}
            accent={amber}
            href={
              !user
                ? routes.auth.login.index.href()
                : user.role === 'admin'
                  ? routes.admin.supportAgent.index.href()
                  : undefined
            }
          />
          <CapCard
            number="03"
            title="Kundenverwaltung"
            desc="360°-Sicht auf Kunden, Termine, Nachrichten und Historie."
            tags={['Profil', 'Verlauf', 'Benachrichtigungen']}
            accent={emerald}
          />
          <CapCard
            number="04"
            title="Administration"
            desc="Nutzer, Rollen, Ressourcen und Systemstatus in Echtzeit."
            tags={['Rollen', 'Audit', 'Reports']}
            accent={rose}
            href={authHref(routes.admin.index.href())}
          />
        </div>
      </section>
    )
  }
}

function CapCard(
  handle: Handle<{
    number: string
    title: string
    desc: string
    tags: string[]
    accent: string
    href?: string
  }>,
) {
  return () => {
    let { number, title, desc, tags, accent, href } = handle.props
    let content = (
      <>
        <div mix={capCardTopCss}>
          <span mix={capNumCss} style={{ color: accent }}>
            {number}
          </span>
          {href ? (
            <Glyph name="arrowRight" width={20} height={20} style={{ color: accent }} />
          ) : null}
        </div>
        <h3 mix={capTitleCss}>{title}</h3>
        <p mix={capDescCss}>{desc}</p>
        <div mix={capTagsCss}>
          {tags.map((t) => (
            <span key={t} mix={capTagCss} style={{ background: `${accent}12`, color: accent }}>
              {t}
            </span>
          ))}
        </div>
        <div
          mix={capBarCss}
          style={{ background: `linear-gradient(90deg, ${accent}, ${accent}40)` }}
        />
      </>
    )
    if (href) {
      return (
        <a href={href} mix={[capCardCss, capCardLinkCss]}>
          {content}
        </a>
      )
    }
    return <article mix={capCardCss}>{content}</article>
  }
}

function CtaSection() {
  return () => (
    <section mix={ctaSectionCss}>
      <div mix={ctaInnerCss}>
        <h2 mix={ctaTitleCss}>Bereit für den Wechsel?</h2>
        <p mix={ctaDescCss}>Starte in 2 Minuten. Keine Kreditkarte nötig.</p>
        <div mix={ctaBtnGroupCss}>
          <a href={routes.auth.register.index.href()} mix={ctaBtnCss}>
            Kostenlos starten
            <Glyph name="arrowRight" width={16} height={16} />
          </a>
          <a href={routes.auth.login.index.href()} mix={ctaGhostCss}>
            Ich habe bereits ein Konto
          </a>
        </div>
      </div>
    </section>
  )
}

function MiniFooter() {
  return () => (
    <footer mix={miniFooterCss}>
      <p mix={miniFooterTextCss}>&copy; {new Date().getFullYear()} newapp. Built with Remix.</p>
    </footer>
  )
}

// ── CSS ──

const rootCss = css({
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100vh',
  overflow: 'hidden',
  background: theme.surface.lvl0,
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
})

const scrollWrapperCss = css({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  minHeight: 0,
})

const scrollAreaCss = css({
  flex: 1,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '6rem',
  maxWidth: '1100px',
  width: '100%',
  margin: '0 auto',
  padding: '0 2rem 4rem',
  boxSizing: 'border-box',
})

// ── Hero ──

const heroSectionCss = css({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '3rem',
  alignItems: 'center',
  minHeight: 'calc(100vh - 80px)',
  paddingTop: '2rem',
})

const heroContentCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1.25rem',
})

const heroLabelCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.25rem 0.75rem',
  borderRadius: theme.radius.full,
  background: `${indigo[500]}0d`,
  color: indigo[500],
  fontSize: '0.75rem',
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  width: 'fit-content',
  border: `1px solid ${indigo[500]}20`,
})

const heroLabelDotCss = css({
  width: '6px',
  height: '6px',
  borderRadius: '50%',
  background: indigo[500],
  animation: 'pulse-dim 2s ease-in-out infinite',
})

const heroTitleCss = css({
  margin: 0,
  fontSize: '3.25rem',
  fontWeight: 800,
  lineHeight: 1.08,
  letterSpacing: '-0.03em',
  color: theme.colors.text.primary,
})

const heroTitleGradCss = css({
  background: `linear-gradient(135deg, ${indigo[500]}, ${indigo[300]}, ${amber})`,
  backgroundSize: '200% 200%',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
  animation: 'gradientShift 6s ease-in-out infinite',
})

const heroDividerCss = css({
  width: '60px',
  height: '3px',
  borderRadius: '2px',
  background: `linear-gradient(90deg, ${indigo[500]}, ${indigo[300]})`,
})

const heroDescCss = css({
  margin: 0,
  fontSize: '1rem',
  lineHeight: 1.65,
  color: theme.colors.text.secondary,
  maxWidth: '420px',
})

const heroBtnGroupCss = css({
  display: 'flex',
  gap: '0.75rem',
  marginTop: '0.5rem',
})

const heroBtnCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.75rem 1.5rem',
  borderRadius: theme.radius.lg,
  background: indigo[600],
  color: 'white',
  textDecoration: 'none',
  fontSize: '0.875rem',
  fontWeight: 600,
  transition: 'all 200ms ease',
  boxShadow: `0 4px 14px ${indigo[500]}40`,
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: `0 8px 25px ${indigo[500]}60`,
    background: indigo[700],
  },
})

const heroGhostBtnCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.75rem 1.25rem',
  borderRadius: theme.radius.lg,
  color: theme.colors.text.secondary,
  textDecoration: 'none',
  fontSize: '0.875rem',
  fontWeight: 500,
  border: `1px solid ${theme.colors.border.default}`,
  transition: 'all 150ms ease',
  '&:hover': {
    color: theme.colors.text.primary,
    borderColor: theme.colors.border.strong,
    background: theme.surface.lvl1,
  },
})

const trustRowCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  marginTop: '1.5rem',
  paddingTop: '1.5rem',
  borderTop: `1px solid ${theme.colors.border.subtle}`,
})

const trustAvatarsCss = css({
  display: 'flex',
})

const trustAvatarCss = css({
  width: '28px',
  height: '28px',
  borderRadius: '50%',
  border: '2px solid',
  marginRight: '-8px',
})

const trustTextCss = css({
  fontSize: '0.8125rem',
  color: theme.colors.text.muted,
  '& strong': { color: theme.colors.text.primary },
})

// ── Hero visual ──

const heroVisualCss = css({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '480px',
})

const heroVisualBgCss = css({
  position: 'absolute',
  width: '400px',
  height: '400px',
  borderRadius: '50%',
  background: `radial-gradient(circle, ${indigo[500]}15, transparent 70%)`,
  animation: 'float 6s ease-in-out infinite',
})

const heroMockupCss = css({
  position: 'relative',
  width: '100%',
  maxWidth: '380px',
  borderRadius: theme.radius.xl,
  overflow: 'hidden',
  border: `1px solid ${theme.colors.border.subtle}`,
  background: theme.surface.lvl1,
  boxShadow: `0 20px 60px ${indigo[500]}20`,
  transform: 'perspective(1000px) rotateY(-3deg) rotateX(2deg)',
  transition: 'transform 400ms ease',
  '&:hover': { transform: 'perspective(1000px) rotateY(0deg) rotateX(0deg)' },
})

const mockupHeaderCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.625rem 0.75rem',
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
  background: theme.surface.lvl2,
})

const mockupDotsCss = css({
  display: 'flex',
  gap: '5px',
})

const mockupDotCss = css({
  width: '8px',
  height: '8px',
  borderRadius: '50%',
})

const mockupTitleCss = css({
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: theme.colors.text.muted,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
})

const mockupBodyCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  padding: '1rem',
})

const statBarRowCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
})

const statBarLabelCss = css({
  fontSize: '0.75rem',
  color: theme.colors.text.secondary,
  width: '80px',
  flexShrink: 0,
})

const statBarTrackCss = css({
  flex: 1,
  height: '6px',
  borderRadius: '3px',
  background: theme.surface.lvl3,
  overflow: 'hidden',
})

const statBarFillCss = css({
  height: '100%',
  borderRadius: '3px',
  transition: 'width 1s ease',
})

const statBarValueCss = css({
  fontSize: '0.8125rem',
  fontWeight: 700,
  width: '20px',
  textAlign: 'right',
})

const mockupGridCss = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '0.375rem',
  marginTop: '0.5rem',
})

const mockupCellCss = css({
  height: '24px',
  borderRadius: theme.radius.sm,
  background: theme.surface.lvl3,
})

const heroFloatingBadge1Css = css({
  position: 'absolute',
  top: '15%',
  right: '-5%',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.375rem',
  padding: '0.375rem 0.75rem',
  borderRadius: theme.radius.full,
  background: theme.surface.lvl1,
  border: `1px solid ${theme.colors.border.subtle}`,
  boxShadow: theme.shadow.sm,
  fontSize: '0.75rem',
  fontWeight: 600,
  color: emerald,
  animation: 'float 5s ease-in-out infinite',
})

const heroFloatingBadge2Css = css({
  position: 'absolute',
  bottom: '20%',
  left: '-8%',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.375rem',
  padding: '0.375rem 0.75rem',
  borderRadius: theme.radius.full,
  background: theme.surface.lvl1,
  border: `1px solid ${theme.colors.border.subtle}`,
  boxShadow: theme.shadow.sm,
  fontSize: '0.75rem',
  fontWeight: 600,
  color: indigo[500],
  animation: 'float 6s ease-in-out infinite 1s',
})

// ── Approach ──

const approachSectionCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  alignItems: 'center',
  textAlign: 'center',
})

const approachLabelCss = css({
  fontSize: '0.75rem',
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: indigo[500],
})

const approachTitleCss = css({
  margin: 0,
  fontSize: '2.25rem',
  fontWeight: 700,
  lineHeight: 1.15,
  letterSpacing: '-0.02em',
  color: theme.colors.text.primary,
  maxWidth: '600px',
})

const approachHighlightCss = css({
  color: indigo[500],
})

const approachDescCss = css({
  margin: 0,
  fontSize: '0.9375rem',
  lineHeight: 1.65,
  color: theme.colors.text.secondary,
  maxWidth: '520px',
})

const approachGridCss = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '1.5rem',
  marginTop: '2rem',
  width: '100%',
})

const approachCardCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  padding: '2rem 1.5rem',
  borderRadius: theme.radius.xl,
  background: theme.surface.lvl1,
  border: `1px solid ${theme.colors.border.subtle}`,
  textAlign: 'left',
  transition: 'all 250ms ease',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: theme.shadow.lg,
    borderColor: theme.colors.border.default,
  },
})

const approachIconCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '40px',
  height: '40px',
  borderRadius: theme.radius.lg,
})

const approachCardTitleCss = css({
  margin: 0,
  fontSize: '1.125rem',
  fontWeight: 600,
  color: theme.colors.text.primary,
})

const approachCardDescCss = css({
  margin: 0,
  fontSize: '0.8125rem',
  lineHeight: 1.6,
  color: theme.colors.text.secondary,
})

// ── Capabilities ──

const capSectionCss = css({})

const capGridCss = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '1.5rem',
})

const capCardCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  padding: '1.75rem',
  borderRadius: theme.radius.xl,
  background: theme.surface.lvl1,
  border: `1px solid ${theme.colors.border.subtle}`,
  overflow: 'hidden',
  position: 'relative',
  transition: 'all 250ms ease',
  '&:hover': { transform: 'translateY(-3px)', boxShadow: theme.shadow.md },
})

const capCardLinkCss = css({
  textDecoration: 'none',
  color: 'inherit',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  padding: '1.75rem',
  borderRadius: theme.radius.xl,
  background: theme.surface.lvl1,
  border: `1px solid ${theme.colors.border.subtle}`,
  overflow: 'hidden',
  position: 'relative',
  transition: 'all 250ms ease',
  cursor: 'pointer',
  '&:hover': {
    transform: 'translateY(-3px)',
    boxShadow: theme.shadow.md,
    borderColor: theme.colors.border.default,
  },
})

const capCardTopCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
})

const capNumCss = css({
  fontSize: '2.5rem',
  fontWeight: 800,
  lineHeight: 1,
  opacity: 0.2,
  fontFamily: theme.fontFamily.sans,
})

const capTitleCss = css({
  margin: 0,
  fontSize: '1.25rem',
  fontWeight: 600,
  color: theme.colors.text.primary,
})

const capDescCss = css({
  margin: 0,
  fontSize: '0.8125rem',
  lineHeight: 1.6,
  color: theme.colors.text.secondary,
})

const capTagsCss = css({
  display: 'flex',
  gap: '0.375rem',
  flexWrap: 'wrap',
})

const capTagCss = css({
  fontSize: '0.6875rem',
  fontWeight: 600,
  padding: '0.125rem 0.5rem',
  borderRadius: theme.radius.full,
})

const capBarCss = css({
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  height: '3px',
  opacity: 0.5,
})

// ── CTA ──

const ctaSectionCss = css({
  padding: '4rem 2rem',
  borderRadius: theme.radius.xl,
  background: `linear-gradient(135deg, ${indigo[700]}, ${indigo[500]})`,
  textAlign: 'center',
})

const ctaInnerCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  alignItems: 'center',
})

const ctaTitleCss = css({
  margin: 0,
  fontSize: '2rem',
  fontWeight: 700,
  color: 'white',
  letterSpacing: '-0.02em',
})

const ctaDescCss = css({
  margin: 0,
  fontSize: '1rem',
  color: `${indigo[200]}`,
})

const ctaBtnGroupCss = css({
  display: 'flex',
  gap: '1rem',
  marginTop: '0.5rem',
})

const ctaBtnCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.75rem 2rem',
  borderRadius: theme.radius.lg,
  background: 'white',
  color: indigo[700],
  textDecoration: 'none',
  fontSize: '0.9375rem',
  fontWeight: 700,
  transition: 'all 200ms ease',
  '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 8px 25px rgba(0,0,0,0.2)' },
})

const ctaGhostCss = css({
  display: 'inline-flex',
  padding: '0.75rem 1.5rem',
  borderRadius: theme.radius.lg,
  color: `${indigo[100]}`,
  textDecoration: 'none',
  fontSize: '0.875rem',
  fontWeight: 500,
  border: `1px solid ${indigo[400]}`,
  transition: 'all 150ms ease',
  '&:hover': { background: `${indigo[600]}`, color: 'white' },
})

// ── Footer ──

const miniFooterCss = css({
  flexShrink: 0,
  borderTop: `1px solid ${theme.colors.border.subtle}`,
  padding: '2px 0',
  textAlign: 'center',
})

const miniFooterTextCss = css({
  margin: 0,
  fontSize: theme.fontSize.xxs,
  color: theme.colors.text.muted,
})
