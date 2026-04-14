/**
 * Platform detection utilities
 * 원본: tomato-farm/game/src/utils/platform.ts (이식 + isIOS 슬롯 추가)
 */

/** 앱인토스(토스 WebView) 환경인지 확인 */
export function isAppsInToss(): boolean {
  if (typeof window === 'undefined') return false;
  // 토스앱 WebView에서는 User-Agent에 TossApp이 포함됨
  if (navigator.userAgent.includes('TossApp')) return true;
  // 앱인토스 SDK가 로드된 경우 (intoss:// scheme 환경)
  const w = window as unknown as Record<string, unknown>;
  if (w['__APPS_IN_TOSS__'] || w['AppsInToss']) return true;
  return false;
}

/** Capacitor 네이티브(Android/iOS) 환경인지 확인 */
export function isNative(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as Record<string, unknown>;
  const cap = w['Capacitor'] as Record<string, unknown> | undefined;
  if (!cap) return false;
  if (cap['isNativePlatform'] === true) return true;
  const getPlatform = cap['getPlatform'] as (() => string) | undefined;
  if (typeof getPlatform !== 'function') return false;
  const platform = getPlatform();
  return platform === 'android' || platform === 'ios';
}

/**
 * iOS 환경인지 확인
 * Capacitor.getPlatform() === 'ios' 기반.
 * Capacitor 미설치(웹 빌드) 시 false fallback.
 */
export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as Record<string, unknown>;
  const cap = w['Capacitor'] as Record<string, unknown> | undefined;
  if (!cap) return false;
  const getPlatform = cap['getPlatform'] as (() => string) | undefined;
  if (typeof getPlatform !== 'function') return false;
  return getPlatform() === 'ios';
}

/** 현재 플랫폼 타입 */
export type PlatformType = 'toss' | 'native' | 'web';

export function getPlatform(): PlatformType {
  if (isAppsInToss()) return 'toss';
  if (isNative()) return 'native';
  return 'web';
}
