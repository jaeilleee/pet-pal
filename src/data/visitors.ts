/**
 * visitors.ts -- 방문자 시스템 (12종: common/rare/legendary)
 */

export interface Visitor {
  id: string;
  name: string;
  emoji: string;
  rarity: 'common' | 'rare' | 'legendary';
  gift: { gold: number; item?: string };
  message: string;
}

export const VISITORS: Visitor[] = [
  { id: 'squirrel', name: '다람쥐', emoji: '🐿️', rarity: 'common', gift: { gold: 10 }, message: '도토리를 가져왔어요!' },
  { id: 'rabbit', name: '토끼', emoji: '🐰', rarity: 'common', gift: { gold: 15 }, message: '당근을 나눠먹자!' },
  { id: 'butterfly', name: '나비', emoji: '🦋', rarity: 'common', gift: { gold: 8 }, message: '예쁜 날개를 보여줄게!' },
  { id: 'ladybug', name: '무당벌레', emoji: '🐞', rarity: 'common', gift: { gold: 12 }, message: '행운을 가져왔어!' },
  { id: 'hedgehog', name: '고슴도치', emoji: '🦔', rarity: 'rare', gift: { gold: 30 }, message: '밤을 선물할게!' },
  { id: 'fox', name: '여우', emoji: '🦊', rarity: 'rare', gift: { gold: 40 }, message: '비밀 장소를 알려줄까?' },
  { id: 'owl', name: '부엉이', emoji: '🦉', rarity: 'rare', gift: { gold: 35 }, message: '지혜를 나눠줄게!' },
  { id: 'deer', name: '사슴', emoji: '🦌', rarity: 'rare', gift: { gold: 45 }, message: '숲에서 왔어요!' },
  { id: 'unicorn', name: '유니콘', emoji: '🦄', rarity: 'legendary', gift: { gold: 100 }, message: '마법의 선물이야!' },
  { id: 'dragon-baby', name: '아기 드래곤', emoji: '🐉', rarity: 'legendary', gift: { gold: 150 }, message: '불꽃을 선물할게!' },
  { id: 'phoenix', name: '불사조', emoji: '🔥', rarity: 'legendary', gift: { gold: 200 }, message: '영원의 깃털이야!' },
  { id: 'fairy', name: '요정', emoji: '🧚', rarity: 'legendary', gift: { gold: 120 }, message: '소원을 들어줄게!' },
];

/** 부재 시간에 비례한 방문자 출현 롤 */
export function rollVisitor(absentHours: number): Visitor | null {
  if (absentHours < 1) return null;
  const chance = Math.min(0.9, absentHours * 0.08); // 1시간=8%, 12시간=96%
  if (Math.random() > chance) return null;

  // 레어리티 롤
  const r = Math.random();
  const pool = r < 0.05
    ? VISITORS.filter(v => v.rarity === 'legendary')
    : r < 0.25
      ? VISITORS.filter(v => v.rarity === 'rare')
      : VISITORS.filter(v => v.rarity === 'common');
  return pool[Math.floor(Math.random() * pool.length)];
}
