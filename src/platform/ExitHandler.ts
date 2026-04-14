/**
 * ExitHandler - 종료 분기 처리
 *
 * 원본: tomato-farm/game/src/ui/HtmlUI.ts showExitConfirmModal() 중 종료 분기 로직 추출
 *
 * exit()이 플랫폼에 따라 3분기로 동작한다:
 *   - toss   : 토스 미니앱 — 우측 상단 X 버튼 안내 토스트 (앱 직접 종료 불가)
 *   - native : Capacitor App.exitApp() (dynamic import)
 *   - web    : window.close() 시도 → 실패 시 안내 토스트
 */
import { isAppsInToss, isNative } from './platform';

export interface ExitHandlerOptions {
  /**
   * 저장 실행 함수 (종료 전 호출).
   * AP-SAVE-EXIT-01: async 함수여야 한다 — Toss Storage 쓰기 완료 대기.
   */
  onSave?: () => Promise<void>;
  /** 안내 메시지 표시 함수 (예: showToast) */
  onMessage?: (msg: string) => void;
}

export class ExitHandler {
  private onSave: (() => Promise<void>) | undefined;
  private onMessage: ((msg: string) => void) | undefined;

  constructor(options: ExitHandlerOptions = {}) {
    this.onSave = options.onSave;
    this.onMessage = options.onMessage;
  }

  /**
   * 종료 처리 — 플랫폼 3분기.
   *
   * toss:   토스 미니앱은 직접 종료 API가 없으므로 X 버튼 안내.
   * native: Capacitor App.exitApp() — dynamic import로 APK 빌드에만 포함.
   * web:    window.close() → 실패 시 "탭을 닫아주세요" 안내.
   */
  async exit(): Promise<void> {
    // AP-SAVE-EXIT-01: await로 Toss Storage 쓰기 완료 보장
    if (this.onSave) {
      try {
        await this.onSave();
      } catch (err) {
        console.warn('[ExitHandler] onSave 실패', err);
      }
    }

    if (isAppsInToss()) {
      // 토스 분기: 직접 종료 불가, X 버튼 안내
      this.onMessage?.('우측 상단 X 버튼으로 종료할 수 있어요!');
      return;
    }

    if (isNative()) {
      // 네이티브 분기: Capacitor App.exitApp() (dynamic import — 웹 번들 미포함)
      try {
        const { App } = await import('@capacitor/app');
        await App.exitApp();
      } catch {
        // Capacitor App 플러그인 없음 → web fallback
        this.webExit();
      }
      return;
    }

    // 웹 분기
    this.webExit();
  }

  private webExit(): void {
    // 토스 환경: 뒤로가기(history.back)로 미니앱 종료 시도
    if (isAppsInToss()) {
      history.back();
      return;
    }
    // 웹: window.close() 시도 + 안내
    window.close();
    this.onMessage?.('저장 완료! 브라우저 탭을 닫아주세요.');
  }
}
