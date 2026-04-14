/**
 * AdManagerWeb - 웹 환경 noop 광고 관리자
 *
 * 순수 웹 브라우저 환경에서 사용된다.
 * 모든 메서드는 noop 또는 Promise.resolve()를 반환한다.
 * hasAds()는 항상 false를 반환하여 광고 버튼을 숨긴다.
 */

import type { IAdManager } from './AdManager';

export class AdManagerWeb implements IAdManager {
  async init(): Promise<void> {
    // 웹 환경: 광고 미지원, 아무것도 하지 않음
  }

  async showRewarded(
    _onReward: () => void,
    _onFail?: () => void,
    _suspendBGM?: () => void,
    _resumeBGM?: () => void,
  ): Promise<boolean> {
    return Promise.resolve(false);
  }

  isRewardedReady(): boolean {
    return false;
  }

  /**
   * 광고 없음 — 항상 false.
   * UI에서 이 값을 확인해 광고 버튼 표시 여부 결정.
   */
  hasAds(): boolean {
    return false;
  }

  async showInterstitial(): Promise<boolean> {
    return Promise.resolve(false);
  }

  async showBanner(): Promise<void> {
    return Promise.resolve();
  }

  async hideBanner(): Promise<void> {
    return Promise.resolve();
  }

  async removeBanner(): Promise<void> {
    return Promise.resolve();
  }

  isBannerVisible(): boolean {
    return false;
  }
}
