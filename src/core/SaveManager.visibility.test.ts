/**
 * AP-REGRESSION-03: visibilitychange + 토스에서 SaveManager.save 호출 0건
 *
 * jsdom 환경에서 document.dispatchEvent(visibilitychange) 후
 * SaveManager.save/saveAsync가 호출되지 않아야 함.
 *
 * 배경: 토스 WebView는 visibilitychange 이벤트 순서가 보장되지 않아,
 * 기본 프레임워크 코드(main.ts + SoundManager)에서 visibilitychange→save를
 * 절대 연결하지 않는다. 이 테스트는 그 계약을 정적으로 보호한다.
 *
 * 원본: tomato-juice/src/core/SaveManager.visibility.test.ts
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SaveManager } from './SaveManager';

// ── Toss Storage mock ─────────────────────────────────────────────────────────
const tossData = new Map<string, string>();

vi.mock('@apps-in-toss/web-framework', () => ({
  Storage: {
    getItem: vi.fn(async (key: string) => tossData.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { tossData.set(key, value); }),
    removeItem: vi.fn(async (key: string) => { tossData.delete(key); }),
  },
}));

const localData = new Map<string, string>();

beforeEach(() => {
  tossData.clear();
  localData.clear();
  vi.clearAllMocks();
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => localData.get(key) ?? null,
      setItem: (key: string, value: string) => { localData.set(key, value); },
      removeItem: (key: string) => { localData.delete(key); },
      clear: () => { localData.clear(); },
      get length() { return localData.size; },
      key: (i: number) => [...localData.keys()][i] ?? null,
    },
    writable: true,
    configurable: true,
  });
});

interface TestState { level: number }
const createInitialState = (): TestState => ({ level: 1 });

describe('AP-REGRESSION-03: visibilitychange(hidden) 시 save 호출 0건 (토스 환경)', () => {
  it('document visibilitychange(hidden) 이벤트 후 sm.save spy 호출 카운트 = 0', () => {
    const sm = new SaveManager<TestState>({
      saveKey: 'test:save',
      legacyKey: 'test:save',
      getInitialState: createInitialState,
    });
    sm.isToss = true;

    const saveSpy = vi.spyOn(sm, 'save');
    const saveAsyncSpy = vi.spyOn(sm, 'saveAsync');

    Object.defineProperty(document, 'hidden', {
      value: true,
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(saveSpy).not.toHaveBeenCalled();
    expect(saveAsyncSpy).not.toHaveBeenCalled();
  });

  it('visibilitychange 이벤트 핸들러를 sm에 직접 등록하지 않은 경우 save 호출 0건', () => {
    const sm = new SaveManager<TestState>({
      saveKey: 'test:save',
      legacyKey: 'test:save',
      getInitialState: createInitialState,
    });
    sm.isToss = true;

    const saveSpy = vi.spyOn(sm, 'save');

    for (let i = 0; i < 3; i++) {
      Object.defineProperty(document, 'hidden', {
        value: i % 2 === 0,
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    }

    expect(saveSpy.mock.calls.length).toBe(0);
  });

  it('AP-SAVE-GUARD-02 정적 검증: SoundManager.ts는 SaveManager / save 호출이 없다', async () => {
    // 회귀 방지: 누군가 SoundManager에 SaveManager.save 호출을 추가하면 이 테스트가 실패한다.
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const soundManagerPath = resolve(__dirname, '../platform/SoundManager.ts');
    const source = readFileSync(soundManagerPath, 'utf8');

    expect(source).not.toMatch(/from\s+['"].*SaveManager['"]/);
    expect(source).not.toMatch(/import\s+.*SaveManager/);
    expect(source).not.toMatch(/\.saveAsync\s*\(/);
    expect(source).not.toMatch(/SaveManager/);
  });
});
