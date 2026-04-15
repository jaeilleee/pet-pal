/**
 * Design Tokens -- PetPal v2.0 "App Store Featured" Design System
 * Animal Crossing UI + Pixar short film warmth
 * OKLCH-based palette with hex fallbacks
 */

export const COLORS = {
  bg: {
    primary: '#f7f0e6',    /* oklch(0.97 0.008 80) */
    secondary: '#fff0e0',
    warm: '#fff0db',
    sky: '#e2f0f8',
    grass: '#f0f8f0',
    night: '#1a1a2e',
  },
  primary: '#e06040',       /* oklch(0.72 0.16 30) — coral */
  primaryDark: '#b83820',   /* oklch(0.58 0.18 30) */
  primaryLight: '#f0b8a0',  /* oklch(0.88 0.08 30) */
  secondary: '#58c8b0',     /* oklch(0.75 0.1 175) — mint */
  secondaryDark: '#3ca898',
  accent: '#f0c840',        /* oklch(0.82 0.15 85) — golden yellow */
  accentDark: '#c8a020',
  pink: '#FFB5C2',
  purple: '#C3AED6',
  blue: '#87CEEB',
  text: {
    dark: '#352820',        /* oklch(0.25 0.015 30) */
    medium: '#786860',      /* oklch(0.50 0.01 30) */
    light: '#a09088',       /* oklch(0.65 0.008 30) */
    white: '#FFFFFF',
    accent: '#e06040',
  },
  ui: {
    cardBg: '#ffffff',
    cardBorder: 'rgba(0,0,0,0.04)',
    glass: 'rgba(252,249,245,0.85)',
    overlay: 'rgba(0,0,0,0.4)',
    danger: '#d43838',
    success: '#48b870',
    warning: '#f0c840',
  },
  stat: {
    hunger: '#e06040',      /* oklch(0.72 0.16 30) */
    happiness: '#f0c840',   /* oklch(0.82 0.15 85) */
    cleanliness: '#68a8d8', /* oklch(0.78 0.1 230) */
    energy: '#48b870',      /* oklch(0.72 0.14 145) */
    bond: '#FFB5C2',
  },
} as const;

export const SHADOWS = {
  card: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
  button: '0 4px 12px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.04), inset 0 -2px 0 rgba(0,0,0,0.08)',
  buttonActive: '0 0 0 transparent, inset 0 1px 2px rgba(0,0,0,0.08)',
  float: '0 12px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
  glow: (color: string): string => `0 0 20px ${color}40`,
} as const;

export const FONTS = {
  primary: "'Nunito', sans-serif",
  rounded: "'Nunito', sans-serif",
  handwrite: "'Gaegu', cursive",
  emoji: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif',
} as const;

export const LAYOUT = {
  maxWidth: 390,
  maxHeight: 780,
  borderRadius: { sm: 8, md: 14, lg: 20, xl: 28 },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 },
  safeTop: 'env(safe-area-inset-top, 0px)',
  safeBottom: 'env(safe-area-inset-bottom, 0px)',
} as const;
