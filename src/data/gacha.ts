/**
 * gacha.ts -- 골드 가챠/뽑기 시스템
 */

export type GachaRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type GachaItemType = 'accessory' | 'color' | 'theme' | 'gold';

export interface GachaItem {
  id: string;
  name: string;
  emoji: string;
  rarity: GachaRarity;
  type: GachaItemType;
  value?: number; // gold 타입일 때
}

export const GACHA_POOL: GachaItem[] = [
  // Common (60%)
  { id: 'g-ribbon-red', name: '빨간 리본', emoji: '🎀', rarity: 'common', type: 'accessory' },
  { id: 'g-gold-50', name: '골드 50', emoji: '💰', rarity: 'common', type: 'gold', value: 50 },
  { id: 'g-gold-30', name: '골드 30', emoji: '💰', rarity: 'common', type: 'gold', value: 30 },
  // Rare (25%)
  { id: 'g-sunglasses', name: '멋진 선글라스', emoji: '🕶️', rarity: 'rare', type: 'accessory' },
  { id: 'g-gold-150', name: '골드 150', emoji: '💎', rarity: 'rare', type: 'gold', value: 150 },
  { id: 'g-bowtie', name: '나비넥타이', emoji: '🎗️', rarity: 'rare', type: 'accessory' },
  // Epic (12%)
  { id: 'g-tiara', name: '티아라', emoji: '👸', rarity: 'epic', type: 'accessory' },
  { id: 'g-gold-300', name: '골드 300', emoji: '💎', rarity: 'epic', type: 'gold', value: 300 },
  // Legendary (3%)
  { id: 'g-halo', name: '천사 후광', emoji: '😇', rarity: 'legendary', type: 'accessory' },
  { id: 'g-gold-1000', name: '대박! 1000G', emoji: '🎰', rarity: 'legendary', type: 'gold', value: 1000 },
];

export const GACHA_COST = 100; // 1회 100G

/** 레어리티별 색상 */
export const RARITY_COLORS: Record<GachaRarity, string> = {
  common: '#A0A0A0',
  rare: '#4FC3F7',
  epic: '#AB47BC',
  legendary: '#FFD700',
};

/** 레어리티별 라벨 */
export const RARITY_LABELS: Record<GachaRarity, string> = {
  common: '일반',
  rare: '레어',
  epic: '에픽',
  legendary: '전설',
};

/** 가챠 1회 굴리기 */
export function rollGacha(): GachaItem {
  const r = Math.random();
  const pool = r < 0.03
    ? GACHA_POOL.filter(i => i.rarity === 'legendary')
    : r < 0.15
      ? GACHA_POOL.filter(i => i.rarity === 'epic')
      : r < 0.40
        ? GACHA_POOL.filter(i => i.rarity === 'rare')
        : GACHA_POOL.filter(i => i.rarity === 'common');
  return pool[Math.floor(Math.random() * pool.length)];
}
