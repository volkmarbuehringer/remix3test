// Brand accent palette for the landing hero. Kept as explicit values so the
// landing stays visually distinct from the app chrome; the neutral surfaces,
// borders and text below all flow through the theme object so dark mode tracks.
export const indigo = {
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

export const amber = '#f59e0b'
export const emerald = '#10b981'
export const rose = '#f43f5e'

// Text-safe accent values. The raw palette above is used for decorative fills
// (bars, dots, gradients); anything rendered as *text* must go through these
// variables so it flips with the theme and keeps WCAG AA contrast.
export const accentText = {
  indigo: 'var(--home-accent-indigo)',
  indigoSoft: 'var(--home-accent-indigo-soft)',
  amber: 'var(--home-accent-amber)',
  emerald: 'var(--home-accent-emerald)',
  muted: 'var(--home-text-muted)',
}
