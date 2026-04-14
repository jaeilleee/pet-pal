/**
 * Design Tokens -- PetPal 비주얼 디자인 시스템
 * 따뜻하고 귀여운 파스텔 톤 기반
 */

export const COLORS = {
  bg: {
    primary: '#FFF5E6',
    secondary: '#FFE8CC',
    warm: '#FFF0DB',
    sky: '#E8F4FD',
    grass: '#E8F5E9',
    night: '#1a1a2e',
  },
  primary: '#FF9A76',
  primaryDark: '#E8845E',
  primaryLight: '#FFB89A',
  secondary: '#7EC8B8',
  secondaryDark: '#5BA898',
  accent: '#FFD93D',
  accentDark: '#E6C235',
  pink: '#FFB5C2',
  purple: '#C3AED6',
  blue: '#87CEEB',
  text: {
    dark: '#3D3D3D',
    medium: '#666666',
    light: '#999999',
    white: '#FFFFFF',
    accent: '#FF9A76',
  },
  ui: {
    cardBg: 'rgba(255,255,255,0.92)',
    cardBorder: 'rgba(255,154,118,0.2)',
    glass: 'rgba(255,255,255,0.85)',
    overlay: 'rgba(0,0,0,0.4)',
    danger: '#FF6B6B',
    success: '#51CF66',
    warning: '#FFD93D',
  },
  stat: {
    hunger: '#FF9A76',
    happiness: '#FFD93D',
    cleanliness: '#87CEEB',
    energy: '#51CF66',
    bond: '#FFB5C2',
  },
} as const;

export const SHADOWS = {
  card: '0 4px 16px rgba(255,154,118,0.15)',
  button: '0 4px 12px rgba(255,154,118,0.25)',
  buttonActive: '0 2px 6px rgba(255,154,118,0.2)',
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
  borderRadius: { sm: 12, md: 18, lg: 24, xl: 32 },
  spacing: { xs: 4, sm: 8, md: 14, lg: 20, xl: 32 },
  safeTop: 'env(safe-area-inset-top, 0px)',
  safeBottom: 'env(safe-area-inset-bottom, 0px)',
} as const;
