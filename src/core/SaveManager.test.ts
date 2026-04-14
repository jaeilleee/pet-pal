/**
 * SaveManager 회귀 테스트
 *
 * AP-REGRESSION-01: 토스 저장 라운드트립
 * AP-REGRESSION-02: 로드 전 save 호출 시 Toss Storage 보호
 * AP-LOAD-01/02/04: loadAsync 기본 동작
 *
 * 토스 환경 시뮬레이션: @apps-in-toss/web-framework Storage mock
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SaveManager } from './SaveManager';

// ── vi.hoisted: mock 팩토리보다 먼저 실행되어 hoisting 문제 없음 ────────────
const { mockTossStorage, mockLocalStorage } = vi.hoisted(() => {
  const tossData = new Map<string, string>();
  const localData = new Map<string, string>();

  return {
    mockTossStorage: {
      data: tossData,
      getItem: vi.fn(async (key: string) => tossData.get(key) ?? null),
      setItem: vi.fn(async (key: string, value: string) => { tossData.set(key, value); }),
      removeItem: vi.fn(async (key: string) => { tossData.delete(key); }),
      clear() { tossData.clear(); },
      reset() {
        tossData.clear();
        this.getItem.mockReset();
        this.setItem.mockReset();
        this.removeItem.mockReset();
        this.getItem.mockImplementation(async (key: string) => tossData.get(key) ?? null);
        this.setItem.mockImplementation(async (key: string, value: string) => { tossData.set(key, value); });
        this.removeItem.mockImplementation(async (key: string) => { tossData.delete(key); });
      },
    },
    mockLocalStorage: {
      data: localData,
      getItem: vi.fn((key: string) => localData.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => { localData.set(key, value); }),
      removeItem: vi.fn((key: string) => { localData.delete(key); }),
      clear() { localData.clear(); },
      reset() {
        localData.clear();
        this.getItem.mockReset();
        this.setItem.mockReset();
        this.removeItem.mockReset();
        this.getItem.mockImplementation((key: string) => localData.get(key) ?? null);
        this.setItem.mockImplementation((key: string, value: string) => { localData.set(key, value); });
        this.removeItem.mockImplementation((key: string) => { localData.delete(key); });
      },
    },
  };
});

// ── @apps-in-toss/web-framework mock ─────────────────────────────────────────
vi.mock('@apps-in-toss/web-framework', () => ({
  Storage: {
    getItem: (key: string) => mockTossStorage.getItem(key),
    setItem: (key: string, value: string) => mockTossStorage.setItem(key, value),
    removeItem: (key: string) => mockTossStorage.removeItem(key),
  },
}));

// ── localStorage mock ─────────────────────────────────────────────────────────
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => mockLocalStorage.getItem(key),
    setItem: (key: string, value: string) => mockLocalStorage.setItem(key, value),
    removeItem: (key: string) => mockLocalStorage.removeItem(key),
    clear: () => mockLocalStorage.clear(),
    get length() { return mockLocalStorage.data.size; },
    key: (i: number) => [...mockLocalStorage.data.keys()][i] ?? null,
  },
  writable: true,
  configurable: true,
});

// ── 테스트용 상태 타입 ─────────────────────────────────────────────────────────
interface TestState {
  level: number;
  gold: number;
}

const createInitialState = (): TestState => ({ level: 1, gold: 0 });

// ── 공통 beforeEach ───────────────────────────────────────────────────────────
beforeEach(() => {
  mockTossStorage.reset();
  mockLocalStorage.reset();
});

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────
function makeTossSM(timeoutMs = 3000): SaveManager<TestState> {
  const sm = new SaveManager<TestState>({
    saveKey: 'test:save',
    legacyKey: 'test:save',
    getInitialState: createInitialState,
    loadTimeoutMs: timeoutMs,
  });
  sm.isToss = true;
  return sm;
}

// ─────────────────────────────────────────────────────────────────────────────
// AP-REGRESSION-01: 토스 저장 라운드트립
// ─────────────────────────────────────────────────────────────────────────────
describe('AP-REGRESSION-01: 토스 저장 라운드트립', () => {
  it('localStorage 초기화 후 재부팅해도 Toss Storage에서 변경된 state가 복원된다', async () => {
    const sm1 = makeTossSM();
    const state1 = await sm1.loadAsync();
    expect(state1.level).toBe(1);

    await sm1.saveAsync({ level: 42, gold: 1000 });
    expect(mockTossStorage.data.get('test:save')).toBe(JSON.stringify({ level: 42, gold: 1000 }));

    mockLocalStorage.data.clear();
    expect(mockLocalStorage.data.get('test:save')).toBeUndefined();

    const sm2 = makeTossSM();
    const restored = await sm2.loadAsync();

    expect(restored.level).toBe(42);
    expect(restored.gold).toBe(1000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AP-REGRESSION-02: 로드 전 save 호출 시 Toss Storage 보호
// ─────────────────────────────────────────────────────────────────────────────
describe('AP-REGRESSION-02: 로드 전 save() 호출 시 Toss Storage 데이터 보호', () => {
  it('isLoaded=false 상태에서 save() 호출 → Toss Storage 변경 없음, localStorage도 변경 없음 (tossOnly)', () => {
    // tossOnly 아키텍처: 토스 모드에서 localStorage 쓰기 완전 차단
    mockTossStorage.data.set('test:save', JSON.stringify({ level: 99, gold: 9999 }));

    const sm = makeTossSM();
    expect(sm.isLoaded).toBe(false);

    sm.save({ level: 1, gold: 0 });

    // tossOnly 모드: localStorage도 변경되지 않아야 함 (AP-TOSSONLY-02)
    expect(mockLocalStorage.data.get('test:save')).toBeUndefined();
    expect(mockTossStorage.data.get('test:save')).toBe(JSON.stringify({ level: 99, gold: 9999 }));
    expect(mockTossStorage.setItem).not.toHaveBeenCalled();
  });

  it('isLoaded=false 상태에서 saveAsync() 호출 → Toss Storage 변경 없음', async () => {
    mockTossStorage.data.set('test:save', JSON.stringify({ level: 99, gold: 9999 }));

    const sm = makeTossSM();
    expect(sm.isLoaded).toBe(false);

    await sm.saveAsync({ level: 1, gold: 0 });

    expect(mockTossStorage.data.get('test:save')).toBe(JSON.stringify({ level: 99, gold: 9999 }));
    expect(mockTossStorage.setItem).not.toHaveBeenCalled();
  });

  it('loadAsync() 완료(isLoaded=true) 후 saveAsync() → Toss Storage에 정상 쓰기', async () => {
    const sm = makeTossSM();
    await sm.loadAsync();

    await sm.saveAsync({ level: 5, gold: 500 });

    expect(mockTossStorage.data.get('test:save')).toBe(JSON.stringify({ level: 5, gold: 500 }));
    expect(mockTossStorage.setItem).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AP-LOAD-01/02/04: loadAsync 기본 동작
// ─────────────────────────────────────────────────────────────────────────────
describe('AP-LOAD-01: loadAsync — Toss Storage에서 읽기', () => {
  it('토스 환경에서 Toss Storage에 있는 데이터를 읽는다', async () => {
    mockTossStorage.data.set('test:save', JSON.stringify({ level: 20, gold: 200 }));

    const sm = makeTossSM();
    const result = await sm.loadAsync();

    expect(result.level).toBe(20);
    expect(mockTossStorage.getItem).toHaveBeenCalledWith('test:save');
  });

  it('Toss Storage와 localStorage 모두 비어있으면 초기 상태 반환', async () => {
    const sm = makeTossSM();
    const result = await sm.loadAsync();

    expect(result.level).toBe(1);
    expect(result.gold).toBe(0);
  });

  it('Toss Storage 비어있고 localStorage에만 있으면 초기 상태 반환 (tossOnly)', async () => {
    mockLocalStorage.data.set('test:save', JSON.stringify({ level: 15, gold: 150 }));

    const sm = makeTossSM();
    const result = await sm.loadAsync();

    // tossOnly: localStorage fallback 없음 — Toss Storage가 단일 진실의 원천
    expect(result.level).toBe(1);
  });
});

describe('AP-LOAD-02: Toss Storage vs localStorage 우선순위', () => {
  it('두 곳 모두 데이터가 있을 때 Toss Storage가 이긴다 (타임스탬프 비교 없음)', async () => {
    mockTossStorage.data.set('test:save', JSON.stringify({ level: 50, gold: 5000 }));
    mockLocalStorage.data.set('test:save', JSON.stringify({ level: 1, gold: 0 }));

    const sm = makeTossSM();
    const result = await sm.loadAsync();

    expect(result.level).toBe(50);
    expect(result.gold).toBe(5000);
  });
});

describe('AP-LOAD-04: isLoaded 플래그', () => {
  it('loadAsync 완료 전 isLoaded=false, 완료 후 isLoaded=true', async () => {
    const sm = makeTossSM();
    expect(sm.isLoaded).toBe(false);

    await sm.loadAsync();

    expect(sm.isLoaded).toBe(true);
  });

  it('비-토스 환경에서도 loadAsync 완료 후 isLoaded=true', async () => {
    const sm = new SaveManager<TestState>({
      saveKey: 'test:save',
      legacyKey: 'test:save',
      getInitialState: createInitialState,
    });
    sm.isToss = false;

    mockLocalStorage.data.set('test:save', JSON.stringify({ level: 7, gold: 70 }));
    const result = await sm.loadAsync();

    expect(result.level).toBe(7);
    expect(sm.isLoaded).toBe(true);
    expect(mockTossStorage.getItem).not.toHaveBeenCalled();
  });
});
