import { css } from 'remix/ui'
import type { Handle } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'
import { Glyph } from '../ui/theme/glyph/glyph.tsx'
import { legal, routes } from '../routes.ts'
import { MainNav } from './main-nav.tsx'

// Brand accent palette for the landing hero. Kept as explicit values so the
// landing stays visually distinct from the app chrome; the neutral surfaces,
// borders and text below all flow through the theme object so dark mode tracks.
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

// Text-safe accent values. The raw palette below is used for decorative fills
// (bars, dots, gradients); anything rendered as *text* must go through these
// variables so it flips with the theme and keeps WCAG AA contrast.
const accentText = {
  indigo: 'var(--home-accent-indigo)',
  indigoSoft: 'var(--home-accent-indigo-soft)',
  amber: 'var(--home-accent-amber)',
  emerald: 'var(--home-accent-emerald)',
  muted: 'var(--home-text-muted)',
}

function HomeStyles() {
  return () => (
    <style>{`
      :root {
        --home-accent-indigo: ${indigo[600]};
        --home-accent-indigo-soft: ${indigo[400]};
        --home-accent-amber: #b45309;
        --home-accent-emerald: #047857;
        --home-text-muted: #5f6672;
      }
      [data-theme="dark"] {
        --home-accent-indigo: #a5b4fc;
        --home-accent-indigo-soft: #c7d2fe;
        --home-accent-amber: #fcd34d;
        --home-accent-emerald: #6ee7b7;
        --home-text-muted: #a3aab2;
      }
      @keyframes fadeSlideUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
      @keyframes pulse-dim { 0%,100%{opacity:.6} 50%{opacity:1} }
      @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
      @keyframes gradientShift { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation: none !important;
          transition: none !important;
        }
      }
    `}</style>
  )
}

export function HomePage() {
  return () => (
    <div mix={rootCss}>
      <HomeStyles />
      <MainNav />
      <main mix={mainCss}>
        <HeroSection />
        <AiSection />
        <ValueStrip />
      </main>
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
          Neu — Verwaltung, die begeistert
        </div>
        <h1 mix={heroTitleCss}>
          Verwaltung,
          <br />
          <span mix={heroTitleGradCss}>die begeistert</span>
        </h1>
        <div mix={heroDividerCss} />
        <p mix={heroDescCss}>
          newapp vereint Terminplanung, Kundenmanagement und intelligente KI-Assistenz in einer
          Plattform, die dein Team lieben wird.
        </p>
        <div mix={heroBtnGroupCss}>
          <a href={routes.auth.register.index.href()} mix={heroBtnCss}>
            <span>Kostenlos starten</span>
            <Glyph name="arrowRight" width={16} height={16} />
          </a>
          <a href={routes.auth.login.index.href()} mix={heroGhostBtnCss}>
            Ich habe bereits ein Konto
          </a>
        </div>
        <ul mix={trustListCss}>
          {['KI-Assistenz inklusive', 'DSGVO-konform', 'Keine Tracker Dritter'].map((item) => (
            <li key={item} mix={trustItemCss}>
              <Glyph name="check" width={14} height={14} style={{ color: accentText.emerald }} />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div mix={heroVisualCss} aria-hidden="true">
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
            <StatBar
              label="Termine heute"
              value="8"
              color={indigo[500]}
              textColor={accentText.indigo}
            />
            <StatBar label="Offen" value="3" color={amber} textColor={accentText.amber} />
            <StatBar label="Erledigt" value="5" color={emerald} textColor={accentText.emerald} />
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

function StatBar(
  handle: Handle<{ label: string; value: string; color: string; textColor: string }>,
) {
  return () => {
    let { label, value, color, textColor } = handle.props
    return (
      <div mix={statBarRowCss}>
        <span mix={statBarLabelCss}>{label}</span>
        <div mix={statBarTrackCss}>
          <div
            mix={statBarFillCss}
            style={{ width: `${Number(value) * 10}%`, background: color }}
          />
        </div>
        <span mix={statBarValueCss} style={{ color: textColor }}>
          {value}
        </span>
      </div>
    )
  }
}

function AiSection() {
  return () => {
    let features = [
      {
        glyph: 'chat' as const,
        title: 'Buchen im Gespräch',
        desc: 'Kundinnen und Kunden nennen Wunsch und Zeitraum in normaler Sprache — die Assistenz findet Leistung, Ressource und freien Slot.',
        accent: indigo[500],
        text: accentText.indigo,
      },
      {
        glyph: 'zap' as const,
        title: 'Abläufe im Hintergrund',
        desc: 'Bestätigungen, Erinnerungen und Absagen laufen als Workflows weiter und landen als Benachrichtigung im Postfach.',
        accent: amber,
        text: accentText.amber,
      },
      {
        glyph: 'shield' as const,
        title: 'Freigabe vor kritischen Aktionen',
        desc: 'Löschen oder Sperren wartet auf deine Bestätigung, bevor die Assistenz etwas Unumkehrbares ausführt.',
        accent: emerald,
        text: accentText.emerald,
      },
    ]
    return (
      <section mix={aiSectionCss} aria-labelledby="ki-assistenz">
        <div mix={aiHeaderCss}>
          <span mix={aiEyebrowCss}>KI-Assistenz</span>
          <h2 id="ki-assistenz" mix={aiTitleCss}>
            Assistenz, die mitdenkt — und trotzdem dir gehört
          </h2>
          <p mix={aiLeadCss}>
            Beschreibe deinen Wunsch in normaler Sprache. Die Assistenz übernimmt Suche, Buchung und
            Nachfassen; kritische Schritte bleiben in deiner Hand.
          </p>
        </div>
        <div mix={aiGridCss}>
          {features.map((f) => (
            <article key={f.title} mix={aiCardCss}>
              <div mix={aiIconCss} style={{ background: `${f.accent}1a`, color: f.text }}>
                <Glyph name={f.glyph} width={20} height={20} />
              </div>
              <h3 mix={aiCardTitleCss}>{f.title}</h3>
              <p mix={aiCardDescCss}>{f.desc}</p>
            </article>
          ))}
        </div>
        <div mix={aiCtaRowCss}>
          <a href={routes.auth.register.index.href()} mix={heroBtnCss}>
            <span>Kostenlos starten</span>
            <Glyph name="arrowRight" width={16} height={16} />
          </a>
        </div>
      </section>
    )
  }
}

function ValueStrip() {
  return () => {
    let items = [
      {
        glyph: 'zap' as const,
        title: 'Blitzschnell',
        desc: 'Ohne Neuladen, ohne Wartezeit',
        accent: indigo[500],
        text: accentText.indigo,
      },
      {
        glyph: 'shield' as const,
        title: 'Sicher & DSGVO',
        desc: 'Europäische Server, volle Kontrolle',
        accent: emerald,
        text: accentText.emerald,
      },
      {
        glyph: 'calendar' as const,
        title: 'Termine',
        desc: 'Intelligente Planung & Erinnerungen',
        accent: amber,
        text: accentText.amber,
      },
    ]
    return (
      <div mix={valueStripCss}>
        {items.map((it) => (
          <div key={it.title} mix={valueStripItemCss}>
            <div mix={valueStripIconCss} style={{ background: `${it.accent}1a`, color: it.text }}>
              <Glyph name={it.glyph} width={18} height={18} />
            </div>
            <div mix={valueStripTextCss}>
              <span mix={valueStripTitleCss}>{it.title}</span>
              <span mix={valueStripDescCss}>{it.desc}</span>
            </div>
          </div>
        ))}
      </div>
    )
  }
}

function MiniFooter() {
  return () => (
    <footer mix={miniFooterCss}>
      <nav mix={miniFooterNavCss} aria-label="Rechtliches">
        <a href={legal.impressum.href()} mix={miniFooterLinkCss}>
          Impressum
        </a>
        <a href={legal.datenschutz.href()} mix={miniFooterLinkCss}>
          Datenschutz
        </a>
        <a href="mailto:hallo@newapp.example" mix={miniFooterLinkCss}>
          Kontakt
        </a>
      </nav>
      <p mix={miniFooterTextCss}>&copy; {new Date().getFullYear()} newapp.</p>
    </footer>
  )
}

// ── CSS ──

const rootCss = css({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: '100vh',
  background: theme.surface.lvl0,
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
})

const mainCss = css({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  // Top-aligned rather than vertically centred: centring left a ~180px void
  // under the nav on a 1000px viewport while the page is taller than that.
  justifyContent: 'flex-start',
  gap: '2.5rem',
  width: '100%',
  maxWidth: '1100px',
  margin: '0 auto',
  padding: '3rem 2rem',
  boxSizing: 'border-box',
})

// ── Hero ──

const heroSectionCss = css({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '3rem',
  alignItems: 'center',
  '@media (max-width: 900px)': {
    gridTemplateColumns: '1fr',
    gap: '2rem',
  },
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
  color: accentText.indigo,
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
  fontSize: '3rem',
  fontWeight: 800,
  lineHeight: 1.08,
  letterSpacing: '-0.03em',
  color: theme.colors.text.primary,
  '@media (max-width: 640px)': {
    fontSize: '2.25rem',
  },
})

const heroTitleGradCss = css({
  background: `linear-gradient(135deg, ${accentText.indigo}, ${accentText.indigoSoft}, ${accentText.amber})`,
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
  flexWrap: 'wrap',
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

const trustListCss = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.5rem 1.25rem',
  margin: '1.5rem 0 0',
  padding: '1.5rem 0 0',
  borderTop: `1px solid ${theme.colors.border.subtle}`,
  listStyle: 'none',
})

const trustItemCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.375rem',
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.secondary,
})

// ── Hero visual ──

const heroVisualCss = css({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '300px',
  '@media (max-width: 900px)': {
    minHeight: '240px',
    marginTop: '0.5rem',
  },
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
  color: accentText.muted,
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
  top: '10%',
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
  color: accentText.emerald,
  animation: 'float 5s ease-in-out infinite',
  '@media (max-width: 1024px)': {
    right: 0,
  },
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
  color: accentText.indigo,
  animation: 'float 6s ease-in-out infinite 1s',
  '@media (max-width: 1024px)': {
    left: 0,
  },
})

// ── KI-Assistenz ──

const aiSectionCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5rem',
  paddingTop: '2.5rem',
  borderTop: `1px solid ${theme.colors.border.subtle}`,
})

const aiHeaderCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  maxWidth: '640px',
})

const aiEyebrowCss = css({
  display: 'inline-block',
  width: 'fit-content',
  padding: '0.125rem 0.625rem',
  borderRadius: theme.radius.full,
  background: `${indigo[500]}0d`,
  color: accentText.indigo,
  fontSize: theme.fontSize.xs,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  border: `1px solid ${indigo[500]}20`,
})

const aiTitleCss = css({
  margin: 0,
  fontSize: '1.75rem',
  fontWeight: 700,
  lineHeight: 1.2,
  letterSpacing: '-0.02em',
  color: theme.colors.text.primary,
})

const aiLeadCss = css({
  margin: 0,
  fontSize: '0.9375rem',
  lineHeight: 1.6,
  color: theme.colors.text.secondary,
})

const aiGridCss = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '1rem',
  '@media (max-width: 900px)': {
    gridTemplateColumns: '1fr',
  },
})

const aiCardCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.625rem',
  padding: '1.25rem',
  borderRadius: theme.radius.xl,
  border: `1px solid ${theme.colors.border.subtle}`,
  background: theme.surface.lvl1,
})

const aiIconCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '40px',
  height: '40px',
  borderRadius: theme.radius.lg,
  flexShrink: 0,
})

const aiCardTitleCss = css({
  margin: 0,
  fontSize: '1rem',
  fontWeight: 600,
  color: theme.colors.text.primary,
})

const aiCardDescCss = css({
  margin: 0,
  fontSize: '0.875rem',
  lineHeight: 1.55,
  color: theme.colors.text.secondary,
})

const aiCtaRowCss = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.75rem',
})

// ── Value strip ──

const valueStripCss = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '1rem',
  paddingTop: '1.5rem',
  borderTop: `1px solid ${theme.colors.border.subtle}`,
  '@media (max-width: 640px)': {
    gridTemplateColumns: '1fr',
  },
})

const valueStripItemCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
})

const valueStripIconCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '40px',
  height: '40px',
  borderRadius: theme.radius.lg,
  flexShrink: 0,
})

const valueStripTextCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.125rem',
  minWidth: 0,
})

const valueStripTitleCss = css({
  fontSize: '0.875rem',
  fontWeight: 600,
  color: theme.colors.text.primary,
})

const valueStripDescCss = css({
  fontSize: '0.7813rem',
  color: theme.colors.text.secondary,
  lineHeight: 1.4,
})

// ── Footer ──

const miniFooterCss = css({
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.375rem',
  borderTop: `1px solid ${theme.colors.border.subtle}`,
  padding: '0.75rem 0',
  textAlign: 'center',
})

const miniFooterNavCss = css({
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  gap: '1rem',
})

const miniFooterLinkCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  // Keeps the 12px label but gives the link a >=24px pointer target.
  padding: '0.25rem 0',
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.secondary,
  textDecoration: 'none',
  '&:hover': {
    color: theme.colors.text.primary,
    textDecoration: 'underline',
  },
})

const miniFooterTextCss = css({
  margin: 0,
  fontSize: theme.fontSize.xxs,
  color: accentText.muted,
})
