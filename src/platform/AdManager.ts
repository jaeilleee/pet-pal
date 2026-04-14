/**
 * AdManager - 광고 관리자 팩토리 + 공통 인터페이스
 *
 * getPlatform() 분기로 플랫폼에 맞는 구현체를 반환한다:
 *   - toss    → AdManagerToss
 *   - native  → AdManagerNative
 *   - web     → AdManagerWeb
 *
 * 사용법:
 *   const ad = createAdManager();
 *   await ad.init();
 *   if (ad.hasAds()) { ... }
 */
import { getPlatform } from './platform';
import { AdManagerNative } from './AdManagerNative';
import { AdManagerToss } from './AdManagerToss';
import { AdManagerWeb } from './AdManagerWeb';

/** 공통 광고 관리자 인터페이스 */
export interface IAdManager {
  init(): Promise<void>;

  /**
   * 보상형 광고 표시.
   * suspendBGM/resumeBGM은 SoundManager.suspendForBackground/resumeFromBackground에 연결.
   */
  showRewarded(
    onReward: () => void,
    onFail?: () => void,
    suspendBGM?: () => void,
    resumeBGM?: () => void,
  ): boolean | Promise<boolean>;

  isRewardedReady(): boolean;

  /**
   * 광고 존재 여부.
   * false이면 UI에서 광고 버튼을 숨겨야 한다.
   */
  hasAds(): boolean;

  /** 전면 광고 표시 (쿨다운 적용) */
  showInterstitial?(): boolean | Promise<boolean>;

  showBanner(): void | Promise<void>;
  hideBanner(): void | Promise<void>;
  isBannerVisible(): boolean;
}

/**
 * 플랫폼에 맞는 AdManager 구현체를 반환한다.
 *
 * toss  → AdManagerToss  (토스 인앱 SDK)
 * native → AdManagerNative (Capacitor AdMob, dynamic import)
 * web    → AdManagerWeb   (noop)
 */
export function createAdManager(): IAdManager {
  const platform = getPlatform();
  switch (platform) {
    case 'toss':
      return new AdManagerToss();
    case 'native':
      return new AdManagerNative();
    case 'web':
    default:
      return new AdManagerWeb();
  }
}
