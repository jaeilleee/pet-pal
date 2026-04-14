/**
 * AdManagerNative - Capacitor AdMob 광고 관리자 (네이티브 전용)
 *
 * 원본: tomato-farm/game/src/utils/AdManager.ts 이식
 * 네이티브(Android/iOS) Capacitor 환경에서만 동작한다.
 * 웹 빌드 시 dynamic import 덕분에 번들에 AdMob SDK가 포함되지 않는다.
 *
 * AdMob ID 치환 변수:
 *   __ADMOB_APP_ID__      — AndroidManifest.xml / Info.plist에 설정
 *   __ADMOB_REWARDED__    — 보상형 광고 유닛 ID
 */

// placeholder: 새 게임에서 실제 값으로 교체
const AD_IDS = {
  banner: 'ca-app-pub-TODO/TODO',
  rewarded: 'ca-app-pub-TODO/TODO',
  interstitial: 'ca-app-pub-TODO/TODO',
} as const;

// 테스트 광고 ID (개발용)
const TEST_AD_IDS = {
  banner: 'ca-app-pub-3940256099942544/6300978111',
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
} as const;

/** 전면 광고 최소 간격: 5분 */
const INTERSTITIAL_COOLDOWN_MS = 5 * 60 * 1000;

/** 개발 모드 여부 */
const IS_DEV = ((import.meta as unknown) as Record<string, Record<string, unknown>>).env?.DEV === true;

// 타입은 src/types/vendor.d.ts에 선언된 @capacitor-community/admob 모듈 타입을 사용
import type { AdMobPlugin } from '@capacitor-community/admob';

interface AdMobModule {
  AdMob: AdMobPlugin;
  RewardAdPluginEvents: Readonly<Record<string, string>>;
  InterstitialAdPluginEvents: Readonly<Record<string, string>>;
  BannerAdSize: Readonly<Record<string, string>>;
  BannerAdPosition: Readonly<Record<string, string>>;
}

import type { IAdManager } from './AdManager';

export class AdManagerNative implements IAdManager {
  private initialized = false;
  /** @internal — dynamic import 결과. 웹 빌드 시 번들에 포함되지 않음 */
  private admob: AdMobModule | null = null;
  private lastInterstitialTime = 0;
  private bannerVisible = false;
  private rewardedLoaded = false;
  private rewardedListenersBound = false;
  private interstitialLoaded = false;
  private interstitialListenersBound = false;

  private getAdId(type: keyof typeof AD_IDS): string {
    return IS_DEV ? TEST_AD_IDS[type] : AD_IDS[type];
  }

  /**
   * AdMob SDK 초기화
   * Capacitor 네이티브 환경에서만 동작. 웹에서는 무시.
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    try {
      // dynamic import: 웹 빌드 번들에 @capacitor-community/admob 미포함
      this.admob = (await import('@capacitor-community/admob')) as AdMobModule;
      const { AdMob } = this.admob;
      await AdMob.initialize({ initializeForTesting: IS_DEV });
      this.initialized = true;
      this.preloadRewarded();
      this.preloadInterstitial();
    } catch {
      // 초기화 실패해도 게임 정상 진행
    }
  }

  /** 보상형 광고 미리 로드 */
  private async preloadRewarded(): Promise<void> {
    if (!this.admob || !this.initialized) return;
    try {
      const { AdMob, RewardAdPluginEvents } = this.admob;
      if (!this.rewardedListenersBound) {
        this.rewardedListenersBound = true;
        AdMob.addListener(RewardAdPluginEvents.Loaded, () => { this.rewardedLoaded = true; });
        AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
          this.rewardedLoaded = false;
          this.preloadRewarded();
        });
        AdMob.addListener(RewardAdPluginEvents.FailedToLoad, () => {
          this.rewardedLoaded = false;
          setTimeout(() => this.preloadRewarded(), 30000);
        });
      }
      await AdMob.prepareRewardVideoAd({ adId: this.getAdId('rewarded'), isTesting: IS_DEV });
    } catch {
      this.rewardedLoaded = false;
    }
  }

  /** 전면 광고 미리 로드 */
  private async preloadInterstitial(): Promise<void> {
    if (!this.admob || !this.initialized) return;
    try {
      const { AdMob, InterstitialAdPluginEvents } = this.admob;
      if (!this.interstitialListenersBound) {
        this.interstitialListenersBound = true;
        AdMob.addListener(InterstitialAdPluginEvents.Loaded, () => { this.interstitialLoaded = true; });
        AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
          this.interstitialLoaded = false;
          this.preloadInterstitial();
        });
        AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, () => {
          this.interstitialLoaded = false;
          setTimeout(() => this.preloadInterstitial(), 30000);
        });
      }
      await AdMob.prepareInterstitial({ adId: this.getAdId('interstitial'), isTesting: IS_DEV });
    } catch {
      this.interstitialLoaded = false;
    }
  }

  /**
   * 보상형 광고 표시
   * 광고 표시 직전 BGM pause, 완료/닫힘 후 resume.
   * 배너 경로에는 BGM pause 없음.
   *
   * @param onReward 광고 시청 완료 콜백
   * @param suspendBGM BGM을 일시정지시키는 함수 (SoundManager.suspendForBackground)
   * @param resumeBGM BGM을 재개하는 함수 (SoundManager.resumeFromBackground)
   */
  async showRewarded(
    onReward: () => void,
    onFail?: () => void,
    suspendBGM?: () => void,
    resumeBGM?: () => void,
  ): Promise<boolean> {
    if (!this.admob || !this.initialized) {
      onFail?.();
      return false;
    }
    if (!this.rewardedLoaded) {
      await this.preloadRewarded();
      onFail?.();
      return false;
    }

    let rewardHandle: Promise<{ remove: () => void }> | null = null;
    let dismissHandle: Promise<{ remove: () => void }> | null = null;

    // 보상형 광고 표시 직전 BGM 일시정지 (visibilitychange 미발생 환경 대응)
    suspendBGM?.();
    let resumed = false;
    const resumeOnce = (): void => {
      if (resumed) return;
      resumed = true;
      resumeBGM?.();
    };
    const cleanup = (): void => {
      rewardHandle?.then(h => h.remove());
      dismissHandle?.then(h => h.remove());
      resumeOnce();
    };

    try {
      const { AdMob, RewardAdPluginEvents } = this.admob;
      rewardHandle = AdMob.addListener(RewardAdPluginEvents.Rewarded, () => { onReward(); cleanup(); });
      dismissHandle = AdMob.addListener(RewardAdPluginEvents.Dismissed, () => { cleanup(); });
      await AdMob.showRewardVideoAd();
      return true;
    } catch {
      cleanup();
      onFail?.();
      return false;
    }
  }

  /** 보상형 광고 사용 가능 여부 */
  isRewardedReady(): boolean {
    return this.initialized && this.rewardedLoaded;
  }

  /** 보상형 광고 있음 여부 (hasAds 인터페이스 구현) */
  hasAds(): boolean {
    return true;
  }

  /**
   * 전면 광고 표시 (5분 쿨다운 적용)
   * 배너 경로이므로 BGM pause 없음.
   */
  async showInterstitial(): Promise<boolean> {
    if (!this.admob || !this.initialized) return false;
    const now = Date.now();
    if (now - this.lastInterstitialTime < INTERSTITIAL_COOLDOWN_MS) return false;
    if (!this.interstitialLoaded) {
      await this.preloadInterstitial();
      return false;
    }
    try {
      const { AdMob } = this.admob;
      await AdMob.showInterstitial();
      this.lastInterstitialTime = Date.now();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 배너 광고 표시 (하단)
   * 배너는 BGM pause 대상 아님 — BGM pause는 showRewarded만.
   */
  async showBanner(): Promise<void> {
    if (!this.admob || !this.initialized || this.bannerVisible) return;
    try {
      const { AdMob, BannerAdSize, BannerAdPosition } = this.admob;
      await AdMob.showBanner({
        adId: this.getAdId('banner'),
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        isTesting: IS_DEV,
      });
      this.bannerVisible = true;
    } catch {
      // 배너 표시 실패 (무시)
    }
  }

  /** 배너 광고 숨기기 */
  async hideBanner(): Promise<void> {
    if (!this.admob || !this.initialized || !this.bannerVisible) return;
    try {
      const { AdMob } = this.admob;
      await AdMob.hideBanner();
      this.bannerVisible = false;
    } catch {
      // 무시
    }
  }

  /** 배너 광고 제거 */
  async removeBanner(): Promise<void> {
    if (!this.admob || !this.initialized) return;
    try {
      const { AdMob } = this.admob;
      await AdMob.removeBanner();
      this.bannerVisible = false;
    } catch {
      // 무시
    }
  }

  /** 배너 현재 표시 중인지 */
  isBannerVisible(): boolean {
    return this.bannerVisible;
  }
}
