import { css } from 'remix/ui'
import type { Handle } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'
import { Glyph } from '../ui/theme/glyph/glyph.tsx'
import { routes } from '../routes.ts'
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
      <FontLoader />
      <Keyframes />
      <MainNav />
      <main mix={mainCss}>
        <HeroSection />
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

function ValueStrip() {
  return () => {
    let items = [
      {
        glyph: 'zap' as const,
        title: 'Blitzschnell',
        desc: 'Ohne Neuladen, ohne Wartezeit',
        accent: indigo[500],
      },
      {
        glyph: 'shield' as const,
        title: 'Sicher & DSGVO',
        desc: 'Europäische Server, volle Kontrolle',
        accent: emerald,
      },
      {
        glyph: 'calendar' as const,
        title: 'Termine',
        desc: 'Intelligente Planung & Erinnerungen',
        accent: amber,
      },
    ]
    return (
      <div mix={valueStripCss}>
        {items.map((it) => (
          <div key={it.title} mix={valueStripItemCss}>
            <div mix={valueStripIconCss} style={{ background: `${it.accent}1a`, color: it.accent }}>
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
  justifyContent: 'center',
  gap: '2.5rem',
  width: '100%',
  maxWidth: '1100px',
  margin: '0 auto',
  padding: '0 2rem',
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
  borderTop: `1px solid ${theme.colors.border.subtle}`,
  padding: '0.75rem 0',
  textAlign: 'center',
})

const miniFooterTextCss = css({
  margin: 0,
  fontSize: theme.fontSize.xxs,
  color: theme.colors.text.muted,
})
