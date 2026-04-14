/**
 * 네이티브 전용 SDK 타입 선언 (stub)
 *
 * @capacitor-community/admob 와 @capacitor/app 은 Capacitor 네이티브 빌드에만 포함된다.
 * 웹 빌드 시에는 dynamic import 경로가 실행되지 않으므로 stub 선언으로 충분하다.
 * 실제 타입은 각 패키지를 설치한 뒤 node_modules에서 확인한다.
 */

declare module '@capacitor-community/admob' {
  export interface AdMobPlugin {
    initialize(opts: { initializeForTesting: boolean }): Promise<void>;
    prepareRewardVideoAd(opts: { adId: string; isTesting: boolean }): Promise<void>;
    showRewardVideoAd(): Promise<void>;
    prepareInterstitial(opts: { adId: string; isTesting: boolean }): Promise<void>;
    showInterstitial(): Promise<void>;
    showBanner(opts: {
      adId: string;
      adSize: string;
      position: string;
      isTesting: boolean;
    }): Promise<void>;
    hideBanner(): Promise<void>;
    removeBanner(): Promise<void>;
    addListener(event: string, handler: () => void): Promise<{ remove: () => void }>;
  }

  export const AdMob: AdMobPlugin;
  export const RewardAdPluginEvents: Readonly<{
    Loaded: string;
    Rewarded: string;
    Dismissed: string;
    FailedToLoad: string;
    FailedToShow: string;
  }>;
  export const InterstitialAdPluginEvents: Readonly<{
    Loaded: string;
    Dismissed: string;
    FailedToLoad: string;
  }>;
  export const BannerAdSize: Readonly<{ ADAPTIVE_BANNER: string; [key: string]: string }>;
  export const BannerAdPosition: Readonly<{ BOTTOM_CENTER: string; [key: string]: string }>;
}

declare module '@capacitor/app' {
  export interface AppPlugin {
    exitApp(): Promise<void>;
    getInfo(): Promise<{ id: string; name: string; build: string; version: string }>;
    addListener(event: string, handler: () => void): Promise<{ remove: () => void }>;
  }
  export const App: AppPlugin;
}
