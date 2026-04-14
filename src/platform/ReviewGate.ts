/**
 * ReviewGate - 리뷰 요청 게이트
 *
 * 원본: tomato-farm/game/src/utils/review.ts 이식
 *
 * 4개 게이트 모두 통과해야 리뷰 요청이 실행된다:
 *   1. 쿨다운(일)        — 마지막 요청 이후 COOLDOWN_DAYS일 경과
 *   2. 세션 1회          — 세션당 1번만 (calledThisSession 플래그)
 *   3. 최소 시간(분)     — 세션 시작 후 MIN_PLAY_MINUTES분 이상 플레이
 *   4. Fix A 플래그      — isAppsInToss() (토스 환경에서만 동작)
 *
 * 토스 환경 아닌 경우 모든 게이트 실패 → no-op.
 * 실패해도 게임 흐름에 영향 없음 (silent-safe).
 */
import { isAppsInToss } from './platform';

/** 글로벌 쿨다운: 3일 */
const COOLDOWN_DAYS = 3;
const GLOBAL_COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

/** 최소 플레이 시간: 30분 */
const MIN_PLAY_MINUTES = 30;
const MIN_PLAY_DURATION_MS = MIN_PLAY_MINUTES * 60 * 1000;

/** 세션당 1회 게이트 플래그 (모듈 레벨 — 탭 새로고침 시 리셋) */
let calledThisSession = false;

export interface ReviewGateState {
  /** 마지막 리뷰 요청 시각 (Unix ms). 0이면 미요청. */
  lastReviewRequestAt: number;
  /** 세션 시작 시각 (Unix ms) */
  sessionStartedAt: number;
}

export interface ReviewGateResult {
  ok: boolean;
  /** 실패 사유 — 디버깅/로깅용 */
  reason?: string;
}

/**
 * 게이트 1: Fix A 플래그 — 토스 환경에서만 동작
 * 게이트 2: 세션 1회 — calledThisSession
 * 게이트 3: 쿨다운(일) — COOLDOWN_DAYS일 경과 여부
 * 게이트 4: 최소 시간(분) — MIN_PLAY_MINUTES분 이상 경과 여부
 */
export function canRequestReview(state: ReviewGateState): ReviewGateResult {
  // Gate 1 (Fix A 플래그): 토스 환경에서만 리뷰 API 사용 가능
  if (!isAppsInToss()) return { ok: false, reason: 'not-toss' };

  // Gate 2: 세션 내 1회 제한
  if (calledThisSession) return { ok: false, reason: 'session-already-called' };

  const now = Date.now();

  // Gate 3: 쿨다운(일) — 마지막 요청 이후 COOLDOWN_DAYS일 경과
  if (state.lastReviewRequestAt && now - state.lastReviewRequestAt < GLOBAL_COOLDOWN_MS) {
    return { ok: false, reason: `cooldown-${COOLDOWN_DAYS}d` };
  }

  // Gate 4: 최소 플레이 시간(분) — 세션 시작 후 MIN_PLAY_MINUTES분 이상
  if (now - state.sessionStartedAt < MIN_PLAY_DURATION_MS) {
    return { ok: false, reason: `too-early-${MIN_PLAY_MINUTES}min` };
  }

  return { ok: true };
}

/**
 * 리뷰 요청 시도.
 * 4개 게이트 모두 통과 시에만 @apps-in-toss/web-framework.requestReview() 호출.
 * 성공 시 true 반환 — 호출부에서 state.lastReviewRequestAt을 현재 시각으로 업데이트.
 * 실패해도 게임 흐름에 영향 없음.
 *
 * @param state ReviewGateState (lastReviewRequestAt, sessionStartedAt)
 * @param trigger 디버깅/로깅용 트리거 식별자 (production에서 무시)
 */
export async function tryRequestReview(state: ReviewGateState, trigger: string): Promise<boolean> {
  const gate = canRequestReview(state);
  if (!gate.ok) return false;

  // await 이전에 플래그 선점 — 빠른 연속 호출로 인한 세션 중복 요청 방지
  calledThisSession = true;
  void trigger; // 프로덕션에서 unused

  try {
    const mod = (await import('@apps-in-toss/web-framework')) as unknown as {
      requestReview?: () => Promise<void>;
    };
    if (typeof mod.requestReview !== 'function') {
      // SDK 경로 없음 — 실제 호출이 발생하지 않았으므로 플래그 롤백
      calledThisSession = false;
      return false;
    }

    await mod.requestReview();
    return true;
  } catch (err) {
    // silent catch 금지 + 세션 플래그 롤백 (실패 시 재시도 허용)
    // 3일 쿨다운이 별도로 스팸 방지하므로 세션 플래그까지 막을 필요는 없다
    console.warn('[ReviewGate] requestReview 실패', err);
    calledThisSession = false;
    return false;
  }
}

/** 테스트/디버깅용: 세션 플래그 리셋 */
export function __resetReviewSession(): void {
  calledThisSession = false;
}
