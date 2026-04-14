/**
 * tutorial-types.ts — InteractiveTutorial 공개 타입 정의
 *
 * 분리 이유: TutorialStep/TutorialOptions 주석 포함 정의가
 * InteractiveTutorial.ts 300줄 제한에 영향을 주므로 추출.
 */

/**
 * 외부에서 튜토리얼 스텝의 상태를 읽기 위한 컨텍스트 객체.
 * 게임별 상태(level, stats 등)를 담아 step 콜백에서 참조한다.
 */
export interface TutorialContext {
  [key: string]: unknown;
}

/**
 * 튜토리얼 한 스텝의 정의.
 * 게임 고유 로직(완료 판정, 베이스라인 캡처)은 콜백으로 주입한다.
 */
export interface TutorialStep {
  /** 스텝 고유 식별자 */
  id: string;
  /** 버블 아이콘/제목 텍스트 (이모지 포함 가능) */
  title: string;
  /** 버블 설명 텍스트 (\n 줄바꿈 지원) */
  description: string;
  /**
   * 스포트라이트 타겟 DOM 요소 반환 함수.
   * null 반환 시 전체 화면 dim + 버블 중앙 배치.
   */
  targetSelector: () => HTMLElement | null;
  /**
   * race-skip 판정: 이 스텝의 액션이 이미 완료된 상태인지 확인.
   *
   * WHY (race-skip 가드 필요):
   * 유저가 스텝 N 수행 중 N+1, N+2까지 미리 완료한 경우
   * advanceStep 진입 시 다음 스텝이 이미 완료 상태일 수 있다.
   * 이를 감지하지 않으면 "좀비 스텝"이 되어 진행이 멈춘다.
   * baseline 없이 즉석 판정 가능한 함수로 빠르게 스킵.
   */
  isStepActionDone: (ctx: TutorialContext) => boolean;
  /**
   * advance 조건 베이스라인 캡처.
   * 스텝 시작 시 현재 상태를 기록해 isAdvanceReady 비교에 사용.
   */
  captureBaseline: (ctx: TutorialContext) => void;
  /**
   * 스텝 완료(advance) 조건.
   * 폴링에서 주기적으로 호출되어 true이면 scheduleAdvance 발동.
   */
  isAdvanceReady: (ctx: TutorialContext) => boolean;
}

export interface TutorialOptions {
  /** 튜토리얼 스텝 목록 (순서대로 진행) */
  steps: TutorialStep[];
  /**
   * 활성 상태 변경 콜백 — GameManager의 tutorialActive 훅 역할.
   *
   * WHY (onActiveChange 외부 콜백 필요):
   * 원본: gm.tutorialActive = true/false 로 GameManager에 직접 알림.
   * 추출본은 GameManager를 모르므로 콜백으로 외부(게임 클래스)에 위임한다.
   * 이 훅 없이는 탭 잠금, 광고 차단 등 tutorialActive 의존 로직이 깨진다.
   */
  onActiveChange: (active: boolean) => void;
  /** 현재 컨텍스트를 반환하는 함수. step 콜백들에 전달된다. */
  getContext: () => TutorialContext;
  /**
   * 튜토리얼 표시를 억제할지 판단하는 콜백 (기존 유저 안전장치).
   *
   * WHY (shouldSuppress 필요):
   * 이미 튜토리얼을 마친 유저에게 다시 표시하면 UX 저하.
   * 원본: gm.state.tutorialShown 검사. 추출본은 상태를 모르므로
   * 호출자가 억제 조건을 결정하도록 위임한다.
   */
  shouldSuppress?: () => boolean;
  /** 완료/스킵 시 콜백 (skipped=true이면 스킵) */
  onFinish?: (skipped: boolean) => void;
  /** 폴링 간격 ms (기본 200) */
  pollIntervalMs?: number;
}
