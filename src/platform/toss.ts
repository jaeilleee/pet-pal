/**
 * Apps-in-Toss (토스 앱인토스) 연동 유틸
 * 원본: tomato-farm/game/src/utils/toss.ts (이식)
 */
import { isAppsInToss } from './platform';

let cachedUserKey: string | null = null;

/**
 * 토스 유저 고유 식별자 가져오기
 * 토스 환경이 아니면 null 반환
 */
export async function getTossUserKey(): Promise<string | null> {
  if (cachedUserKey) return cachedUserKey;
  if (!isAppsInToss()) return null;

  try {
    const { getUserKeyForGame } = await import('@apps-in-toss/web-framework');
    const result = await getUserKeyForGame();

    if (result && typeof result === 'object' && result.type === 'HASH') {
      cachedUserKey = result.hash;
      return result.hash;
    }
  } catch (err) {
    // SDK 로드 실패 또는 비-토스 환경
    console.warn('[toss] getUserKeyForGame 실패', err);
  }
  return null;
}

/**
 * 토스 환경 초기화 (앱 진입 시 1회 호출)
 */
export async function initToss(): Promise<void> {
  if (!isAppsInToss()) return;

  const userKey = await getTossUserKey();
  if (userKey) {
    // Toss user identified (production에서는 로깅 제거)
  }
}
