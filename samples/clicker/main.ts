/**
 * samples/clicker/main.ts — 미니 클리커 샘플
 *
 * 목적: game-template의 SaveManager + InteractiveTutorial을 최소 코드로 검증.
 * 기능:
 *   1. 카운터 버튼 — 클릭 시 count 증가
 *   2. SaveManager로 저장/로드 — 새로고침 후에도 count 유지
 *   3. 1-step 튜토리얼 — "버튼을 클릭하세요" 가이드
 *      start → (클릭 감지) → advance → finish 경로 검증
 *
 * AP-8.3 + AP-5.5 검증용 샘플.
 * 이 파일은 tsc --noEmit 단독 통과 확인용. 런타임은 선택적.
 */

import { SaveManager } from '../../src/core/SaveManager.js';
import {
  InteractiveTutorial,
  type TutorialStep,
  type TutorialContext,
} from '../../src/ui/InteractiveTutorial.js';

// ── 상태 타입 ────────────────────────────────────────────────

interface ClickerState {
  count: number;
  tutorialShown: boolean;
}

function createInitialState(): ClickerState {
  return { count: 0, tutorialShown: false };
}

// ── SaveManager 인스턴스 ──────────────────────────────────────

const saveManager = new SaveManager<ClickerState>({
  saveKey: 'clicker-sample-save',
  legacyKey: 'clicker-sample-save',
  getInitialState: createInitialState,
});

// ── 앱 상태 ──────────────────────────────────────────────────

let state: ClickerState = saveManager.load();
let tutorialActive = false;

// ── DOM 헬퍼 ─────────────────────────────────────────────────

function getEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id) as T | null;
  if (!el) throw new Error(`#${id} 요소를 찾을 수 없습니다`);
  return el;
}

function render(): void {
  getEl<HTMLSpanElement>('count-display').textContent = String(state.count);
}

// ── 튜토리얼 스텝 정의 ───────────────────────────────────────

/**
 * 1-step 튜토리얼: "버튼을 한 번 클릭하세요"
 *
 * start→advance→finish 경로:
 *   start()  → 스텝 표시
 *   isAdvanceReady → count > baseline 이면 true → scheduleAdvance
 *   advanceStep → steps 끝 → finish()
 */
let baselineCount = 0;

const clickStep: TutorialStep = {
  id: 'click-once',
  title: '버튼을 클릭하세요',
  description: '카운터 버튼을 한 번 누르면 튜토리얼이 완료됩니다.',
  targetSelector: () => document.getElementById('click-btn'),
  captureBaseline: (ctx: TutorialContext) => {
    baselineCount = (ctx['count'] as number) ?? 0;
  },
  isStepActionDone: (ctx: TutorialContext) => {
    return (ctx['count'] as number) > 0;
  },
  isAdvanceReady: (ctx: TutorialContext) => {
    return (ctx['count'] as number) > baselineCount;
  },
};

// ── 튜토리얼 인스턴스 ────────────────────────────────────────

const tutorial = new InteractiveTutorial({
  steps: [clickStep],
  onActiveChange: (active: boolean) => {
    tutorialActive = active;
  },
  getContext: (): TutorialContext => ({ count: state.count }),
  shouldSuppress: () => state.tutorialShown,
  onFinish: (skipped: boolean) => {
    if (!skipped) {
      state.tutorialShown = true;
      saveManager.save(state);
    }
  },
});

// ── 이벤트 핸들러 ────────────────────────────────────────────

function onClickBtn(): void {
  if (tutorialActive) return; // 튜토리얼 중 직접 탭 차단
  state.count += 1;
  saveManager.save(state);
  render();
}

function onResetBtn(): void {
  state = createInitialState();
  saveManager.save(state);
  render();
}

// ── 초기화 ──────────────────────────────────────────────────

function init(): void {
  render();

  getEl<HTMLButtonElement>('click-btn').addEventListener('click', onClickBtn);
  getEl<HTMLButtonElement>('reset-btn').addEventListener('click', onResetBtn);

  // 최초 방문 시 튜토리얼 시작 (start → advance → finish 경로)
  tutorial.start(() => {
    // 튜토리얼 완료 — start→advance→finish 경로 검증됨
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
