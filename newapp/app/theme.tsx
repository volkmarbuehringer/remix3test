import { createTheme } from 'remix/ui/theme'

// ── Light mode ──

const lightSurface = {
  lvl0: '#f7fbff',
  lvl1: '#f0f4f7',
  lvl2: '#eef2f6',
  lvl3: '#e8ecf0',
  lvl4: '#dee2e6',
  dangerBg: '#fef2f2',
  dangerText: '#991b1b',
  dangerBorder: '#fecaca',
  successBg: '#f0fdf4',
  successText: '#166534',
  successBorder: '#bbf7d0',
}

const lightColors = {
  text: {
    primary: '#313539',
    secondary: '#5a5e62',
    muted: '#94989c',
    link: '#2dacf9',
  },
  border: {
    subtle: '#e8ecf0',
    default: '#d0d4d8',
    strong: '#a0a4a8',
  },
  focus: { ring: '#2dacf9' },
  overlay: { scrim: 'rgba(0, 0, 0, 0.28)' },
  brand: {
    accent: '#c73d2a',
    accentHover: '#a83222',
  },
  action: {
    primary: {
      background: '#2dacf9',
      backgroundHover: '#2596e0',
      backgroundActive: '#1e80c7',
      foreground: 'rgb(255 255 255 / 0.92)',
      border: '#2dacf9',
    },
    secondary: {
      background: '#ffffff',
      backgroundHover: '#f7fbff',
      backgroundActive: '#eef2f6',
      foreground: '#313539',
      border: '#d0d4d8',
    },
    danger: {
      background: '#dc2626',
      backgroundHover: '#b91c1c',
      backgroundActive: '#991b1b',
      foreground: 'rgb(255 255 255 / 0.92)',
      border: '#dc2626',
    },
  },
}

// ── Shared token groups (identical between light and dark) ──

const BASE_THEME_VALUES = {
  space: {
    none: '0px',
    px: '1px',
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    xxl: '32px',
  },
  radius: {
    none: '0px',
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px',
  },
  fontFamily: {
    sans: "'JetBrains Mono', ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  fontSize: {
    xxxs: '10px',
    xxs: '11px',
    xs: '12px',
    sm: '13px',
    md: '14px',
    lg: '16px',
    xl: '20px',
    xxl: '28px',
  },
  lineHeight: {
    tight: '1.25',
    normal: '1.45',
    relaxed: '1.65',
  },
  letterSpacing: {
    tight: '-0.03em',
    normal: '0',
    meta: '0.06em',
    wide: '0.08em',
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  control: {
    height: {
      sm: '28px',
      md: '32px',
      lg: '36px',
    },
  },
}

const lightShadow = {
  xs: '0 1px 1px rgb(0 0 0 / 0.05)',
  sm: '0 1px 2px rgb(0 0 0 / 0.07)',
  md: '0 6px 18px rgb(0 0 0 / 0.08)',
  lg: '0 16px 34px rgb(0 0 0 / 0.10)',
  xl: '0 24px 52px rgb(0 0 0 / 0.14)',
}

export const Theme = createTheme({
  ...BASE_THEME_VALUES,
  surface: lightSurface,
  shadow: lightShadow,
  colors: lightColors,
})

// ── Dark mode ──

const darkSurface = {
  lvl0: '#363a3e',
  lvl1: '#313539',
  lvl2: '#2d3135',
  lvl3: '#262a2e',
  lvl4: '#1e2226',
  dangerBg: '#3b1111',
  dangerText: '#fca5a5',
  dangerBorder: '#7f1d1d',
  successBg: '#052e16',
  successText: '#86efac',
  successBorder: '#166534',
}

const darkColors = {
  text: {
    primary: '#dee2e6',
    secondary: '#a0a4a8',
    muted: '#6c7074',
    link: '#5bc0ff',
  },
  border: {
    subtle: '#262a2e',
    default: '#3d4145',
    strong: '#5a5e62',
  },
  focus: { ring: '#5bc0ff' },
  overlay: { scrim: 'rgba(0, 0, 0, 0.7)' },
  brand: {
    accent: '#d64d3a',
    accentHover: '#c73d2a',
  },
  action: {
    primary: {
      background: '#2dacf9',
      backgroundHover: '#5bc0ff',
      backgroundActive: '#7acfff',
      foreground: '#1e2226',
      border: '#2dacf9',
    },
    secondary: {
      background: '#2d3135',
      backgroundHover: '#363a3e',
      backgroundActive: '#3d4145',
      foreground: '#dee2e6',
      border: '#3d4145',
    },
    danger: {
      background: '#ef4444',
      backgroundHover: '#dc2626',
      backgroundActive: '#b91c1c',
      foreground: '#1e2226',
      border: '#ef4444',
    },
  },
}

const darkShadow = {
  xs: '0 1px 2px rgb(0 0 0 / 0.4)',
  sm: '0 1px 3px rgb(0 0 0 / 0.5)',
  md: '0 6px 18px rgb(0 0 0 / 0.5)',
  lg: '0 16px 34px rgb(0 0 0 / 0.55)',
  xl: '0 24px 52px rgb(0 0 0 / 0.6)',
}

export const DarkTheme = createTheme(
  { ...BASE_THEME_VALUES, surface: darkSurface, shadow: darkShadow, colors: darkColors },
  { selector: '[data-theme="dark"]', reset: false },
)

// ── Brand palette (extracts raw values for use outside the theme contract) ──

export const brand = {
  light: {
    accent: lightColors.brand.accent,
    accentHover: lightColors.brand.accentHover,
  },
  dark: {
    accent: darkColors.brand.accent,
    accentHover: darkColors.brand.accentHover,
  },
}
