/**
 * TimeGuard -- 시간 조작 방지 + 날짜 유틸
 * 원본: tomato-juice timeGuard.ts
 */

/** KST 기준 오늘 날짜 ISO (YYYY-MM-DD) */
export function safeTodayISO(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

/** 시간 건강 여부 확인 (시계 되돌림 감지) */
export function isClockHealthy(maxSeenDateISO: string): boolean {
  const today = safeTodayISO();
  return today >= maxSeenDateISO;
}

/** maxSeenDate 갱신 */
export function advanceMaxSeen(current: string): string {
  const today = safeTodayISO();
  return today > current ? today : current;
}

/** 두 날짜 사이 일수 차이 */
export function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  return Math.floor(Math.abs(b - a) / (24 * 60 * 60 * 1000));
}

/** 어제 날짜인지 확인 */
export function isYesterday(dateISO: string): boolean {
  return daysBetween(dateISO, safeTodayISO()) === 1 && dateISO < safeTodayISO();
}

/** 같은 날인지 확인 */
export function isSameDay(dateISO: string): boolean {
  return dateISO === safeTodayISO();
}

/** 현재 시간대 (아침/낮/저녁/밤) */
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}

/** 시간대별 배경색 */
export function getTimeBackground(): string {
  switch (getTimeOfDay()) {
    case 'morning': return 'linear-gradient(180deg, #FFE8CC 0%, #FFF5E6 100%)';
    case 'afternoon': return 'linear-gradient(180deg, #E8F4FD 0%, #FFF5E6 100%)';
    case 'evening': return 'linear-gradient(180deg, #FFD4A3 0%, #FF9A76 100%)';
    case 'night': return 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)';
  }
}
