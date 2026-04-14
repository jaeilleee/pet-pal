/**
 * lucky-drops.ts -- 럭키 드롭 시스템 (돌봄 액션 후 10% 확률 보너스)
 */

export interface LuckyDrop {
  type: 'gold' | 'bond';
  label: string;
  emoji: string;
  value: number;
}

const DROPS: LuckyDrop[] = [
  { type: 'gold', label: '골드 x2', emoji: '💰', value: 20 },
  { type: 'gold', label: '골드 x5', emoji: '💎', value: 50 },
  { type: 'bond', label: '유대감 UP', emoji: '💕', value: 5 },
  { type: 'bond', label: '유대감 BIG UP', emoji: '❤️‍🔥', value: 10 },
  { type: 'gold', label: '잭팟!', emoji: '🎰', value: 100 },
];

/** 액션 후 10% 확률로 드롭 */
export function rollLuckyDrop(): LuckyDrop | null {
  if (Math.random() > 0.10) return null;
  return DROPS[Math.floor(Math.random() * DROPS.length)];
}
