/**
 * InteractiveTutorial.ts — 게임 독립형 인터랙티브 튜토리얼 시스템
 *
 * 설계 원칙:
 * - 게임 로직 의존성 0 — GameManager, GameState 참조 금지
 * - step 정의는 외부에서 주입 (TutorialStep 인터페이스 참조)
 * - 원본 tomato-farm InteractiveTutorial.ts의 모든 가드 보존
 * - 과도한 일반화 금지 — 코어 루프는 원본 구조 유지
 *
 * 참조: tomato-farm/game/src/ui/InteractiveTutorial.ts (읽기 전용)
 */

import {
  DimElements,
  hideDimRegions,
  centerBubble,
  layoutDimRegions,
  positionBubbleNearTarget,
} from './tutorial-dim.js';
import {
  ensureOverlay,
  renderBubble,
  showCompletionToast,
  fadeOutAndRemove,
} from './tutorial-overlay.js';
import type { TutorialStep, TutorialOptions, TutorialContext } from './tutorial-types.js';

// re-export for consumers who import from this file
export type { TutorialStep, TutorialOptions, TutorialContext } from './tutorial-types.js';

interface BoundHandler {
  cleanup: () => void;
}

export class InteractiveTutorial {
  private readonly options: Required<TutorialOptions>;
  private overlayEl: HTMLDivElement | null = null;
  private currentStepIndex = 0;
  private active = false;
  private boundHandlers: BoundHandler[] = [];
  private onComplete: (() => void) | null = null;

  /**
   * advance가 이미 예약됐는지 — 중복 advance 차단.
   *
   * WHY (advancing 플래그 필요):
   * scheduleAdvance가 setTimeout 기반이라 폴링이 짧은 간격으로
   * isAdvanceReady를 여러 번 true로 감지하면 연속 호출된다.
   * advancing=true로 첫 예약 이후를 모두 차단해 중복 실행 방지.
   */
  private advancing = false;

  constructor(options: TutorialOptions) {
    this.options = {
      shouldSuppress: () => false,
      onFinish: () => undefined,
      pollIntervalMs: 200,
      ...options,
    };
  }

  /** 튜토리얼 시작. 이미 active이거나 억제 조건이면 무시. */
  start(onComplete?: () => void): void {
    if (this.active) return;

    // WHY (shouldSuppress 선행 검사):
    // tutorialShown 유저 등에게 시작 자체를 막아야 DOM 오염 없이 종료.
    if (this.options.shouldSuppress()) return;

    this.active = true;
    this.options.onActiveChange(true);
    this.currentStepIndex = 0;
    this.onComplete = onComplete ?? null;
    this.captureAndRender();
  }

  /** 강제 종료 (씬 전환 시 cleanup) */
  stop(): void {
    if (!this.active) return;
    this.finish(true);
  }

  /** 현재 활성 여부 */
  isActive(): boolean { return this.active; }

  /** 현재 스텝 ID (외부 탭 잠금 등에 사용) */
  getCurrentStepId(): string | null {
    if (!this.active) return null;
    return this.options.steps[this.currentStepIndex]?.id ?? null;
  }

  /**
   * advance 예약 — advancing 플래그로 중복 차단.
   * public으로 노출해 외부 이벤트 기반 advance도 지원 가능.
   *
   * WHY (scheduleAdvance + advancing 필요):
   * 폴링·이벤트 핸들러가 짧은 시간 안에 연속 발화할 때
   * advancing=true로 첫 번째 예약 이후를 모두 차단한다.
   */
  scheduleAdvance(delayMs: number): void {
    if (this.advancing || !this.active) return;
    this.advancing = true;
    setTimeout(() => {
      if (!this.active) return;
      this.advanceStep();
    }, delayMs);
  }

  // ─── 내부 흐름 ─────────────────────────────────────────

  private captureAndRender(): void {
    if (!this.active) return;
    const step = this.options.steps[this.currentStepIndex];
    if (!step) { this.finish(false); return; }
    step.captureBaseline(this.options.getContext());
    this.render();
  }

  private render(): void {
    if (!this.active) return;
    this.cleanupHandlers();
    const step = this.options.steps[this.currentStepIndex];
    if (!step) { this.finish(false); return; }

    this.overlayEl = ensureOverlay(this.overlayEl, () => this.finish(true));
    renderBubble(
      this.overlayEl,
      step.title,
      step.description,
      this.currentStepIndex,
      this.options.steps.length,
    );
    this.positionHighlight(step);
    this.startPolling(step);
  }

  private positionHighlight(step: TutorialStep): void {
    if (!this.overlayEl) return;
    const els: DimElements = {
      dimTop:    this.overlayEl.querySelector('.tutorial-dim-top')       as HTMLDivElement,
      dimBottom: this.overlayEl.querySelector('.tutorial-dim-bottom')    as HTMLDivElement,
      dimLeft:   this.overlayEl.querySelector('.tutorial-dim-left')      as HTMLDivElement,
      dimRight:  this.overlayEl.querySelector('.tutorial-dim-right')     as HTMLDivElement,
      ring:      this.overlayEl.querySelector('.tutorial-highlight-ring') as HTMLDivElement,
      bubble:    this.overlayEl.querySelector('.tutorial-bubble')        as HTMLDivElement,
    };
    const target = step.targetSelector();
    if (!target) { hideDimRegions(els); centerBubble(els.bubble); return; }
    const rect = target.getBoundingClientRect();
    layoutDimRegions(rect, 6, els);
    positionBubbleNearTarget(rect, els.bubble);
  }

  /**
   * 폴링 기반 완료 감지.
   *
   * WHY (이벤트 기반 대신 폴링 선택):
   * 게임 EventEmitter에 의존하면 InteractiveTutorial이 게임 이벤트 구현에 결합된다.
   * 폴링은 구현 독립적이며 타겟 DOM 재포지셔닝(tiles 변화 시)도 함께 처리 가능.
   */
  private startPolling(step: TutorialStep): void {
    const interval = setInterval(() => {
      if (!this.active) { clearInterval(interval); return; }
      const ctx: TutorialContext = this.options.getContext();
      if (step.isAdvanceReady(ctx)) {
        clearInterval(interval);
        this.scheduleAdvance(600);
      } else {
        this.positionHighlight(step);
      }
    }, this.options.pollIntervalMs);
    this.boundHandlers.push({ cleanup: () => clearInterval(interval) });
  }

  /**
   * 다음 스텝으로 전진.
   *
   * 진입부에서 race-skip 루프 실행 — captureBaseline 전 다음 스텝 isStepActionDone 검사.
   *
   * WHY (race-skip 루프 필요):
   * 유저가 스텝 N 수행 중 N+1, N+2까지 미리 완료한 경우
   * isStepActionDone 먼저 실행해 완료된 스텝을 연속 스킵한다.
   * 이후 살아남은 스텝에만 captureBaseline 적용해 baseline 오염 방지.
   */
  private advanceStep(): void {
    this.advancing = false;
    this.cleanupHandlers();
    this.currentStepIndex++;
    const ctx: TutorialContext = this.options.getContext();

    while (this.currentStepIndex < this.options.steps.length) {
      if (this.options.steps[this.currentStepIndex].isStepActionDone(ctx)) {
        this.currentStepIndex++;
      } else {
        break;
      }
    }

    if (this.currentStepIndex >= this.options.steps.length) {
      this.finish(false);
      return;
    }
    this.captureAndRender();
  }

  private cleanupHandlers(): void {
    for (const h of this.boundHandlers) h.cleanup();
    this.boundHandlers = [];
  }

  private finish(skipped: boolean): void {
    if (!this.active) return;
    this.active = false;
    this.advancing = false; // pending scheduleAdvance 차단 후 재시작 가능 상태로
    this.options.onActiveChange(false);
    this.cleanupHandlers();
    this.options.onFinish(skipped);

    // onComplete는 DOM 정리(fadeOut) 완료 후 호출 — 재시작 경로에서 이전 overlay와 공존 방지
    const cb = this.onComplete;
    this.onComplete = null;

    if (this.overlayEl) {
      const el = this.overlayEl;
      this.overlayEl = null;
      fadeOutAndRemove(el, () => {
        el.remove();
        if (!skipped) showCompletionToast();
        cb?.();
      });
    } else {
      cb?.();
    }
  }
}
