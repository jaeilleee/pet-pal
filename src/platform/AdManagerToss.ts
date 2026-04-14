/**
 * AdManagerToss - 토스(Apps-in-Toss) 광고 관리자
 *
 * 원본: tomato-farm/game/src/utils/TossAdManager.ts 이식
 * 토스 인앱 광고 2.0 ver2 SDK를 사용하여 보상형/배너 광고를 관리한다.
 * 토스 환경이 아닌 경우 모든 호출이 조용히 무시된다.
 *
 * 광고 키 치환 변수:
 *   __TOSS_REWARDED__  — 보상형 광고 그룹 ID
 *   __TOSS_BANNER__    — 배너 광고 그룹 ID
 *
 * 주의: @apps-in-toss/web-framework는 dynamic import 경로에서만 호출되므로
 *       웹(순수 브라우저) 번들에 포함되지 않는다.
 */
import { isAppsInToss } from './platform';

const TOSS_AD_IDS = {
  rewarded: 'TODO',
  banner: 'TODO',
} as const;

type TossWebFramework = typeof import('@apps-in-toss/web-framework');

import type { IAdManager } from './AdManager';

export class AdManagerToss implements IAdManager {
  private initialized = false;
  /** @internal — dynamic import. 웹 빌드 시 번들에 포함되지 않음 */
  private sdk: TossWebFramework | null = null;
  private rewardedLoaded = false;
  private bannerAttached = false;
  private bannerInitialized = false;
  private bannerPending = false;
  private bannerDestroy: (() => void) | null = null;
  private unregisterLoad: (() => void) | null = null;

  /**
   * 토스 광고 SDK 초기화
   * 토스 환경이 아니면 조용히 종료.
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    if (!isAppsInToss()) return;

    try {
      // dynamic import: 토스 환경에서만 SDK 로드
      this.sdk = await import('@apps-in-toss/web-framework');
      this.initialized = true;
      this.preloadRewarded();

      const { TossAds } = this.sdk;
      if (TossAds.initialize.isSupported()) {
        TossAds.initialize({
          callbacks: {
            onInitialized: () => {
              this.bannerInitialized = true;
              if (this.bannerPending) this.showBanner();
            },
            onInitializationFailed: () => {
              // 배너 SDK 초기화 실패 (무시)
            },
          },
        });
      }
    } catch {
      // SDK 로드 실패 (무시)
    }
  }

  /** 보상형 광고 미리 로드 */
  private preloadRewarded(): void {
    if (!this.sdk || !this.initialized) return;
    const { loadFullScreenAd } = this.sdk;
    if (!loadFullScreenAd.isSupported()) return;

    this.unregisterLoad?.();
    this.unregisterLoad = loadFullScreenAd({
      options: { adGroupId: TOSS_AD_IDS.rewarded },
      onEvent: (event: { type: string }) => {
        if (event.type === 'loaded') this.rewardedLoaded = true;
      },
      onError: () => {
        this.rewardedLoaded = false;
        setTimeout(() => this.preloadRewarded(), 30000);
      },
    });
  }

  /** 보상형 광고 사용 가능 여부 */
  isRewardedReady(): boolean {
    if (!isAppsInToss()) return false;
    return this.initialized && this.rewardedLoaded;
  }

  /** 보상형 광고 있음 여부 */
  hasAds(): boolean {
    return isAppsInToss();
  }

  /**
   * 보상형 광고 표시
   * 광고 표시 직전 BGM pause, 완료/닫힘 후 resume.
   * 배너 경로에는 BGM pause 없음.
   *
   * @param onReward 광고 시청 완료 콜백
   * @param onFail 광고 실패/취소 콜백
   * @param suspendBGM BGM을 일시정지시키는 함수 (SoundManager.suspendForBackground)
   * @param resumeBGM BGM을 재개하는 함수 (SoundManager.resumeFromBackground)
   */
  showRewarded(
    onReward: () => void,
    onFail: (() => void) | undefined,
    suspendBGM: () => void,
    resumeBGM: () => void,
  ): boolean {
    if (!this.sdk || !this.initialized || !this.rewardedLoaded) {
      onFail?.();
      return false;
    }

    const { showFullScreenAd } = this.sdk;
    if (!showFullScreenAd.isSupported()) {
      onFail?.();
      return false;
    }

    let rewarded = false;
    // 보상형 광고 표시 직전 BGM 일시정지 (토스 WebView는 visibilitychange 미발생)
    suspendBGM();
    let resumed = false;
    const resumeOnce = (): void => {
      if (resumed) return;
      resumed = true;
      resumeBGM();
    };

    showFullScreenAd({
      options: { adGroupId: TOSS_AD_IDS.rewarded },
      onEvent: (event: { type: string }) => {
        switch (event.type) {
          case 'userEarnedReward':
            rewarded = true;
            onReward();
            break;
          case 'dismissed':
            this.rewardedLoaded = false;
            resumeOnce();
            if (!rewarded) onFail?.();
            this.preloadRewarded();
            break;
          case 'failedToShow':
            this.rewardedLoaded = false;
            resumeOnce();
            onFail?.();
            this.preloadRewarded();
            break;
        }
      },
      onError: () => {
        this.rewardedLoaded = false;
        resumeOnce();
        onFail?.();
        this.preloadRewarded();
      },
    });

    return true;
  }

  /**
   * 배너 광고 표시 (상단)
   * 배너는 BGM pause 대상 아님.
   */
  showBanner(): void {
    if (!this.sdk || !this.initialized || this.bannerAttached) return;
    if (!this.bannerInitialized) {
      this.bannerPending = true;
      return;
    }

    const { TossAds } = this.sdk;
    if (!TossAds.attachBanner.isSupported()) return;

    let container = document.getElementById('toss-banner-ad');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toss-banner-ad';
      container.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:96px;z-index:500;';
      document.body.appendChild(container);
    }

    const result = TossAds.attachBanner(TOSS_AD_IDS.banner, container, {
      theme: 'auto',
      tone: 'blackAndWhite',
      variant: 'expanded',
      callbacks: {
        onAdRendered: () => {
          this.bannerAttached = true;
          document.documentElement.style.setProperty('--safe-top', '96px');
        },
        onAdFailedToRender: () => {
          this.bannerAttached = false;
          if (container) container.style.display = 'none';
        },
        onNoFill: () => {
          this.bannerAttached = false;
          if (container) container.style.display = 'none';
        },
      },
    });

    this.bannerDestroy = result?.destroy ?? null;
  }

  /** 배너 광고 제거 */
  hideBanner(): void {
    this.bannerDestroy?.();
    this.bannerDestroy = null;
    this.bannerAttached = false;
    const container = document.getElementById('toss-banner-ad');
    if (container) container.remove();
    document.documentElement.style.setProperty(
      '--safe-top', 'max(env(safe-area-inset-top, 20px), 20px)'
    );
  }

  /** 배너 현재 표시 중인지 */
  isBannerVisible(): boolean {
    return this.bannerAttached;
  }
}
