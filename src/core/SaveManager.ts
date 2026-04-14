/**
 * SaveManager — 제네릭 저장/로드 유틸리티
 *
 * 원본: tomato-farm/game/src/utils/GameManager.ts
 *   saveGame(), saveGameAsync(), loadGame(), resetCloudStorage() 로직 추출
 *
 * 의존성 역전: 게임별 상태 타입·직렬화·역직렬화를 생성자 옵션으로 주입.
 * 토스 Storage는 isToss 플래그로 제어, SDK는 dynamic import.
 *
 * ## 마이그레이션 계약 (중요)
 * 기본 `deserialize`는 `JSON.parse`만 수행하므로 **필드 마이그레이션을 하지 않는다**.
 * 게임 상태에 새 필드를 추가하거나 구조를 변경할 경우, `deserialize` 옵션에
 * 마이그레이션 로직을 반드시 주입해야 한다. 그렇지 않으면 구 세이브의 신규 필드가
 * undefined로 로드되어 조용한 버그가 발생한다.
 *
 * 예시:
 * ```ts
 * new SaveManager<GameState>({
 *   deserialize: (json) => {
 *     const raw = JSON.parse(json) as Partial<GameState>;
 *     return { ...createInitialState(), ...raw, newField: raw.newField ?? [] };
 *   },
 * });
 * ```
 *
 * ## 번들 분리
 * `@apps-in-toss/web-framework`는 dynamic import로만 참조한다. 비-토스 웹 빌드 시
 * 이 패키지를 `optionalDependencies`로 처리하거나 번들러 externals에 추가하여
 * 웹 번들에 포함되지 않도록 할 것.
 *
 * ## Toss Storage-Only 모드 (v3.6.22 후속)
 * - isToss=true 시 tossOnly=true 자동 설정.
 * - save()/saveAsync(): localStorage 쓰기 완전 제거 (단일 진실의 원천 = Toss Storage).
 * - loadAsync(): Toss Storage 비어있으면 getInitialState() 반환 (신규 유저).
 * - Toss Storage 로드 2회 연속 실패 시 isLoaded=false 유지 + onLoadFail 훅 호출.
 *   → save가 차단되어 Lv1으로 덮어쓰기 방지.
 * - 비-토스 환경: localStorage 경로 그대로 (tossOnly=false).
 *
 * ## isLoaded 가드 (v2.94)
 * - isLoaded 플래그가 true가 되기 전에는 Toss Storage 쓰기를 절대 금지.
 *   (토스 WebView 초기화 중 save() 호출이 Lv1으로 덮어쓰는 사고 방지)
 *
 * ## 타임스탬프 비교 금지 (토마토농장 교훈)
 * - localStorage와 Toss Storage의 타임스탬프를 비교하지 않는다.
 *   타임스탬프 비교로 인한 Lv1 덮어쓰기 사고 재발 방지.
 */

/** SaveManager 생성자 옵션 */
export interface SaveManagerOptions<TState> {
  /** localStorage / 토스 Storage에서 사용할 기본 키 */
  saveKey: string;
  /**
   * 마이그레이션용 레거시 키.
   * 토스 Storage 초기화 시 이 키도 함께 removeItem.
   * saveKey와 동일하면 이중 삭제 없이 1회만 실행.
   */
  legacyKey: string;
  /** 세이브 없음 또는 파싱 실패 시 반환할 초기 상태 팩토리 */
  getInitialState: () => TState;
  /** TState → JSON 문자열 (기본값: JSON.stringify) */
  serialize?: (state: TState) => string;
  /**
   * JSON 문자열 → TState (기본값: JSON.parse).
   * 필드 마이그레이션이 필요하면 반드시 주입 — 위 JSDoc "마이그레이션 계약" 참조.
   */
  deserialize?: (json: string) => TState;
  /**
   * loadAsync 타임아웃 (ms). 기본값: 5000.
   * Toss Storage 응답이 이 시간 내 없으면 에러로 처리.
   */
  loadTimeoutMs?: number;
  /**
   * Toss Storage 로드 최종 실패 시 호출되는 훅.
   * 기본값: console.error.
   * 게임에서 토스트 표시 등 유저 알림에 활용할 것.
   * AP-TOSSONLY-07: 재시도 2회 모두 실패 시 이 훅 호출.
   */
  onLoadFail?: (error: unknown) => void;
}

export class SaveManager<TState> {
  private readonly saveKey: string;
  private readonly legacyKey: string;
  private readonly getInitialState: () => TState;
  private readonly serialize: (state: TState) => string;
  private readonly deserialize: (json: string) => TState;
  private readonly loadTimeoutMs: number;
  private readonly onLoadFailHook: (error: unknown) => void;

  /** 토스 환경 여부 — 외부에서 설정 (main.ts 등) */
  isToss = false;

  /**
   * 토스 환경에서 localStorage 쓰기 완전 차단 플래그.
   * isToss=true 설정 시 자동으로 true가 됨.
   * AP-TOSSONLY-01: tossOnly=true → save()/saveAsync()에서 localStorage.setItem 호출 없음.
   */
  get tossOnly(): boolean {
    return this.isToss;
  }

  /**
   * 로드 완료 플래그. loadAsync() resolve 후 true.
   * AP-SAVE-GUARD-01: isLoaded === false 상태에서는 Toss Storage 쓰기 차단.
   * AP-REGRESSION-T03: Toss Storage 로드 2회 실패 시 false 유지 → save 차단.
   */
  isLoaded = false;

  /** 토스 Storage 연속 실패 횟수 (3회 시 알림) */
  private storageFailCount = 0;
  private legacyKeyWritten = false;

  /**
   * 토스 Storage 쓰기 큐.
   * save() fire-and-forget과 saveAsync() await 호출 모두 이 큐에 합류하여
   * 시간 순서(호출 순서)대로 직렬화된다. 체인이 에러로 끊어지지 않도록
   * 큐 자체는 catch로 삼키고, 개별 await 호출은 원본 Promise로 에러를 전달받는다.
   */
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(options: SaveManagerOptions<TState>) {
    this.saveKey = options.saveKey;
    this.legacyKey = options.legacyKey;
    this.getInitialState = options.getInitialState;
    this.serialize = options.serialize ?? ((s) => JSON.stringify(s));
    this.deserialize = options.deserialize ?? ((j) => JSON.parse(j) as TState);
    this.loadTimeoutMs = options.loadTimeoutMs ?? 5000;
    this.onLoadFailHook = options.onLoadFail ?? ((error) => {
      console.error('[SaveManager] Toss Storage 로드 최종 실패. 이번 세션 저장 불가.', error);
    });
  }

  // ---------------------------------------------------------------------------
  // 공개 메서드
  // ---------------------------------------------------------------------------

  /**
   * fire-and-forget 저장.
   * 비-토스 환경: localStorage에 즉시 쓰기.
   * 토스 환경(tossOnly=true): localStorage 쓰기 없음, Toss Storage 큐에만 합류.
   * 빠른 주기 호출(틱 단위)에 적합. 쓰기 순서는 큐로 보장된다.
   *
   * AP-TOSSONLY-02: isToss=true 시 localStorage.setItem 호출 0건.
   * AP-SAVE-GUARD-01: isLoaded === false 상태에서는 Toss Storage 쓰기 스킵.
   */
  save(state: TState): void {
    try {
      const json = this.serialize(state);
      if (this.isToss) {
        // 토스 모드: localStorage 쓰기 완전 차단 (AP-TOSSONLY-02)
        if (!this.isLoaded) {
          // 로드 전 Toss Storage 쓰기 차단 — Lv1 덮어쓰기 방지
          console.warn('[SaveManager] isLoaded=false: Toss Storage 쓰기 차단');
          return;
        }
        // 큐 합류 (fire-and-forget) — 큐 자체는 chain이 끊기지 않도록 이미 catch됨
        void this.enqueueTossWrite(json);
      } else {
        // 비-토스 환경: localStorage 경로 그대로 (AP-TOSSONLY-09)
        localStorage.setItem(this.saveKey, json);
      }
    } catch (error) {
      this.onSaveFail(error);
    }
  }

  /**
   * await 가능한 저장.
   * 비-토스 환경: localStorage에 즉시 쓰기.
   * 토스 환경(tossOnly=true): localStorage 쓰기 없음, Toss Storage 큐에 합류 후 완료까지 대기.
   * 즉시 종료 직전(환생/초기화)에 사용. 큐에 합류하므로 save()/saveAsync() 간 순서 보장.
   *
   * AP-TOSSONLY-03: isToss=true 시 localStorage.setItem 호출 0건.
   * AP-SAVE-GUARD-01: isLoaded === false 상태에서는 Toss Storage 쓰기 스킵.
   */
  async saveAsync(state: TState): Promise<void> {
    try {
      const json = this.serialize(state);
      if (this.isToss) {
        // 토스 모드: localStorage 쓰기 완전 차단 (AP-TOSSONLY-03)
        if (!this.isLoaded) {
          // 로드 전 Toss Storage 쓰기 차단 — Lv1 덮어쓰기 방지
          console.warn('[SaveManager] isLoaded=false: Toss Storage 쓰기 차단');
          return;
        }
        await this.enqueueTossWrite(json);
      } else {
        // 비-토스 환경: localStorage 경로 그대로 (AP-TOSSONLY-09)
        localStorage.setItem(this.saveKey, json);
      }
    } catch (error) {
      this.onSaveFail(error);
      throw error;
    }
  }

  /**
   * localStorage에서 상태를 읽어 반환 (동기).
   * 비-토스 환경 또는 loadAsync 내부 위임용.
   * 토스 환경에서는 loadAsync()를 사용하라.
   *
   * ⚠️ 필드 마이그레이션은 수행하지 않는다. deserialize 옵션 참조.
   */
  load(): TState {
    try {
      const json = localStorage.getItem(this.saveKey);
      if (!json) return this.getInitialState();
      try {
        return this.deserialize(json);
      } catch (error) {
        // 파싱 실패: 손상된 세이브 → initial state fallback
        console.warn('[SaveManager] 세이브 파싱 실패, 초기 상태로 복구', error);
        return this.getInitialState();
      }
    } catch (error) {
      console.warn('[SaveManager] 세이브 로드 실패', error);
      return this.getInitialState();
    }
  }

  /**
   * 비동기 로드 — 토스 환경에서는 Toss Storage를 단일 진실의 원천으로 읽는다.
   *
   * AP-LOAD-01: 토스 환경이면 Toss Storage에서 saveKey를 읽어 반환.
   * AP-LOAD-04: resolve 후 isLoaded = true 설정.
   * AP-TOSSONLY-05: Toss Storage 비어있으면 getInitialState() 반환 (신규 유저).
   * AP-TOSSONLY-07 & AP-REGRESSION-T03:
   *   Toss Storage getItem이 throw하면 1회 재시도 (총 2번).
   *   2회 모두 실패 시:
   *     - getInitialState() 반환 (localStorage fallback 금지)
   *     - isLoaded = false 유지 → save 차단 → Lv1 덮어쓰기 방지
   *     - onLoadFail 훅 호출로 유저에게 알림
   *
   * 비-토스 환경에서는 동기 load()에 위임 후 즉시 resolve.
   */
  async loadAsync(): Promise<TState> {
    if (!this.isToss) {
      // 비-토스: 동기 load에 위임 (AP-TOSSONLY-09)
      const state = this.load();
      this.isLoaded = true;
      return state;
    }

    // 토스 환경: Toss Storage 단일 진실의 원천으로 로드
    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const state = await this.loadWithTimeout();
        this.isLoaded = true;
        return state;
      } catch (error) {
        lastError = error;
        if (attempt < 2) {
          console.warn(`[SaveManager] loadAsync 시도 ${attempt} 실패, 재시도...`, error);
        }
      }
    }

    // 2회 모두 실패: isLoaded=false 유지, onLoadFail 훅 호출 (AP-REGRESSION-T03)
    console.error('[SaveManager] Toss Storage 2회 로드 실패. 저장 기능 비활성화.', lastError);
    // 훅은 try/catch로 보호 — 훅 내부 예외가 loadAsync를 crash시키지 않도록 (code-review HIGH-3)
    try {
      this.onLoadFailHook(lastError);
    } catch (hookError) {
      console.error('[SaveManager] onLoadFail 훅에서 예외 발생', hookError);
    }
    // isLoaded는 false 유지 → save/saveAsync 차단
    return this.getInitialState();
  }

  /**
   * 토스 Storage 초기화 — resetGame 직후 호출.
   * saveKey + legacyKey 두 키 모두 removeItem 후 초기 상태를 saveAsync.
   */
  async resetCloudStorage(): Promise<void> {
    if (!this.isToss) return;
    if (!this.isLoaded) {
      console.warn('[SaveManager] resetCloudStorage 스킵: isLoaded=false (loadAsync 먼저 호출 필요)');
      return;
    }
    try {
      const { Storage } = await import('@apps-in-toss/web-framework');
      try { await Storage.removeItem(this.saveKey); } catch (e) { console.debug('[SaveManager] removeItem saveKey 실패', e); }
      if (this.saveKey !== this.legacyKey) {
        try { await Storage.removeItem(this.legacyKey); } catch (e) { console.debug('[SaveManager] removeItem legacyKey 실패', e); }
      }
      // 초기 상태를 즉시 fresh save — 큐 경유로 순서 보장
      await this.saveAsync(this.getInitialState());
    } catch (error) {
      console.warn('[SaveManager] resetCloudStorage 실패', error);
    }
  }

  // ---------------------------------------------------------------------------
  // 내부 헬퍼
  // ---------------------------------------------------------------------------

  /**
   * Toss Storage 로드 + 타임아웃 처리.
   * 타임아웃(loadTimeoutMs) 초과 시 에러 throw → loadAsync에서 재시도 처리.
   * localStorage fallback 없음 (tossOnly 원칙).
   */
  private async loadWithTimeout(): Promise<TState> {
    // code-review HIGH-1: clearTimeout으로 타이머 누수 방지
    let timerId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timerId = setTimeout(() => {
        reject(new Error(`[SaveManager] Toss Storage 응답 없음 (${this.loadTimeoutMs}ms)`));
      }, this.loadTimeoutMs);
    });

    try {
      return await Promise.race([this.loadFromTossStorage(), timeoutPromise]);
    } finally {
      if (timerId !== undefined) clearTimeout(timerId);
    }
  }

  /**
   * Toss Storage에서 실제 로드 — 다중 키 탐색 + lastSavedAt 비교.
   *
   * 1. saveKey + legacyKey 두 키 모두 Toss Storage에서 읽기
   * 2. 각 JSON을 파싱해서 lastSavedAt 타임스탬프 비교 → 가장 최신 선택
   * 3. 모두 비어있으면 getInitialState()
   *
   * ⚠️ 타임스탬프 비교는 "Toss Storage 내 여러 키 간"만 허용.
   *    localStorage vs Toss Storage 비교는 절대 금지 (토마토농장 Lv1 사고 재발 방지).
   *
   * getItem throw 시 상위(loadAsync)에서 재시도 처리.
   */
  private async loadFromTossStorage(): Promise<TState> {
    const { Storage } = await import('@apps-in-toss/web-framework');

    // 다중 키 탐색: saveKey(유저별) + legacyKey(전역)
    const keys = this.saveKey === this.legacyKey ? [this.saveKey] : [this.saveKey, this.legacyKey];
    let bestJson: string | null = null;
    let bestTime = -1;

    for (const key of keys) {
      const json = await Storage.getItem(key);
      if (!json) continue;
      try {
        const parsed = JSON.parse(json) as { lastSavedAt?: number };
        const savedAt = typeof parsed.lastSavedAt === 'number' ? parsed.lastSavedAt : 0;
        if (savedAt > bestTime) {
          bestTime = savedAt;
          bestJson = json;
        }
      } catch {
        // 파싱 실패 시 fallback — 아무것도 없는 것보단 낫다
        if (bestJson === null) bestJson = json;
      }
    }

    if (bestJson !== null) {
      // Toss Storage에 데이터 있음 (AP-TOSSONLY-04)
      try {
        return this.deserialize(bestJson);
      } catch (error) {
        console.warn('[SaveManager] Toss Storage 파싱 실패, 초기 상태로 복구', error);
        return this.getInitialState();
      }
    }

    // Toss Storage 비어있음 → 신규 유저로 취급
    return this.getInitialState();
  }

  /**
   * 토스 쓰기를 큐에 합류.
   * 반환 Promise는 "이 호출의 쓰기"만 resolve/reject하므로 await 시 정확한 에러 전달.
   * writeQueue 자체는 catch로 체인을 유지한다.
   */
  private enqueueTossWrite(json: string): Promise<void> {
    const next = this.writeQueue.then(() => this.tossWrite(json));
    this.writeQueue = next.catch(() => undefined);
    return next;
  }

  /**
   * 토스 Storage에 실제 쓰기 — 큐 내부에서만 호출.
   * 현재 키 + 레거시 키 둘 다 저장 (키 변경 시에도 복구 가능).
   */
  private async tossWrite(json: string): Promise<void> {
    try {
      const { Storage } = await import('@apps-in-toss/web-framework');
      await Storage.setItem(this.saveKey, json);
      // legacyKey는 최초 1회만 쓴다 (cross-account 오염 방지).
      if (this.saveKey !== this.legacyKey && !this.legacyKeyWritten) {
        try {
          await Storage.setItem(this.legacyKey, json);
          this.legacyKeyWritten = true;
        } catch { /* backup key fail ok */ }
      }
      this.storageFailCount = 0;
    } catch (error) {
      this.storageFailCount += 1;
      if (this.storageFailCount >= 3) this.onCloudSaveFail(error);
      throw error;
    }
  }

  /**
   * localStorage 쓰기 실패 알림 훅.
   * 기본: console.warn. 게임별 알림 로직은 override 가능.
   */
  protected onSaveFail(error?: unknown): void {
    console.warn('[SaveManager] 저장 실패! localStorage 용량을 확인하세요.', error);
  }

  /**
   * 토스 Storage 연속 3회 실패 알림 훅.
   * 기본: console.warn. 게임별 notification emit으로 override.
   */
  protected onCloudSaveFail(error?: unknown): void {
    console.warn('[SaveManager] 클라우드 저장 실패. 앱 재시작 후 다시 시도해주세요.', error);
  }
}
