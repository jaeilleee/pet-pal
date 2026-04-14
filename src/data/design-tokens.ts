/**
 * Design Tokens -- PetPal 비주얼 디자인 시스템
 * 선명한 대비 + 깨끗한 기반 + 포인트 컬러
 */

export const COLORS = {
  bg: {
    primary: '#FAFAFA',
    secondary: '#FFF3E0',
    warm: '#FFF0DB',
    sky: '#E8F4FD',
    grass: '#E8F5E9',
    night: '#1a1a2e',
  },
  primary: '#FF7043',
  primaryDark: '#E64A19',
  primaryLight: '#FFAB91',
  secondary: '#26A69A',
  secondaryDark: '#00897B',
  accent: '#FFD600',
  accentDark: '#F9A825',
  pink: '#FFB5C2',
  purple: '#C3AED6',
  blue: '#87CEEB',
  text: {
    dark: '#212121',
    medium: '#555555',
    light: '#777777',
    white: '#FFFFFF',
    accent: '#FF7043',
  },
  ui: {
    cardBg: 'rgba(255,255,255,0.96)',
    cardBorder: 'rgba(0,0,0,0.08)',
    glass: 'rgba(255,255,255,0.88)',
    overlay: 'rgba(0,0,0,0.4)',
    danger: '#FF6B6B',
    success: '#51CF66',
    warning: '#FFD600',
  },
  stat: {
    hunger: '#FF7043',
    happiness: '#FFD600',
    cleanliness: '#87CEEB',
    energy: '#51CF66',
    bond: '#FFB5C2',
  },
} as const;

export const SHADOWS = {
  card: '0 2px 12px rgba(0,0,0,0.08)',
  button: '0 3px 10px rgba(255,112,67,0.3)',
  buttonActive: '0 1px 4px rgba(255,112,67,0.2)',
  float: '0 8px 32px rgba(0,0,0,0.12)',
  glow: (color: string) => `0 0 20px ${color}40`,
} as const;

export const FONTS = {
  primary: "'Quicksand', 'Pretendard', sans-serif",
  rounded: "'Nunito', 'Quicksand', 'Pretendard', sans-serif",
  emoji: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif',
} as const;

export const LAYOUT = {
  maxWidth: 390,
  maxHeight: 780,
  borderRadius: { sm: 8, md: 12, lg: 16, xl: 24 },
  spacing: { xs: 4, sm: 8, md: 14, lg: 20, xl: 32 },
  safeTop: 'env(safe-area-inset-top, 0px)',
  safeBottom: 'env(safe-area-inset-bottom, 0px)',
} as const;
