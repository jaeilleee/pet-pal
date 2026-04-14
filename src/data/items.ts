/**
 * Items -- 먹이, 간식, 액세서리, 가구 정의
 */

export type ItemCategory = 'food' | 'snack' | 'accessory' | 'furniture' | 'room-theme';

export interface ItemDef {
  id: string;
  name: string;
  emoji: string;
  category: ItemCategory;
  price: number;
  /** 스탯 영향 */
  effects: Partial<Record<'hunger' | 'happiness' | 'cleanliness' | 'energy' | 'bond', number>>;
  description: string;
  /** 해금 조건 (유대감 최소치) */
  unlockBond?: number;
}

export const ITEMS: ItemDef[] = [
  // === Food (배고픔 해결) ===
  { id: 'kibble', name: '사료', emoji: '🥣', category: 'food', price: 5, effects: { hunger: 20 }, description: '기본 사료' },
  { id: 'meat', name: '고기', emoji: '🥩', category: 'food', price: 15, effects: { hunger: 35, happiness: 5 }, description: '맛있는 고기' },
  { id: 'fish', name: '생선', emoji: '🐟', category: 'food', price: 12, effects: { hunger: 30, energy: 5 }, description: '신선한 생선' },
  { id: 'salad', name: '샐러드', emoji: '🥗', category: 'food', price: 10, effects: { hunger: 20, energy: 10 }, description: '건강한 샐러드' },
  { id: 'steak', name: '스테이크', emoji: '🥩', category: 'food', price: 30, effects: { hunger: 50, happiness: 15, bond: 3 }, description: '프리미엄 스테이크', unlockBond: 100 },

  // === Snack (행복 + 약간의 배고픔) ===
  { id: 'cookie', name: '쿠키', emoji: '🍪', category: 'snack', price: 8, effects: { happiness: 15, hunger: 5 }, description: '달콤한 쿠키' },
  { id: 'cake', name: '케이크', emoji: '🍰', category: 'snack', price: 20, effects: { happiness: 30, hunger: 10 }, description: '생일 케이크' },
  { id: 'icecream', name: '아이스크림', emoji: '🍦', category: 'snack', price: 12, effects: { happiness: 20, hunger: 5 }, description: '시원한 아이스크림' },
  { id: 'candy', name: '사탕', emoji: '🍬', category: 'snack', price: 5, effects: { happiness: 10 }, description: '알록달록 사탕' },
  { id: 'premium-treat', name: '고급 간식', emoji: '🎂', category: 'snack', price: 40, effects: { happiness: 40, bond: 5 }, description: '특별한 간식', unlockBond: 150 },

  // === Accessory (유대감 + 보너스) ===
  { id: 'ribbon', name: '리본', emoji: '🎀', category: 'accessory', price: 30, effects: { happiness: 10, bond: 2 }, description: '귀여운 리본' },
  { id: 'hat', name: '모자', emoji: '🎩', category: 'accessory', price: 50, effects: { happiness: 15, bond: 3 }, description: '멋진 모자' },
  { id: 'glasses', name: '선글라스', emoji: '🕶️', category: 'accessory', price: 40, effects: { happiness: 12, bond: 2 }, description: '쿨한 선글라스' },
  { id: 'crown', name: '왕관', emoji: '👑', category: 'accessory', price: 200, effects: { happiness: 30, bond: 10 }, description: '황금 왕관', unlockBond: 300 },
  { id: 'scarf', name: '스카프', emoji: '🧣', category: 'accessory', price: 35, effects: { happiness: 10, bond: 2 }, description: '따뜻한 스카프' },

  // === Furniture (집 꾸미기) ===
  { id: 'bed', name: '쿠션 침대', emoji: '🛏️', category: 'furniture', price: 60, effects: { energy: 20, bond: 3 }, description: '폭신한 침대' },
  { id: 'toy-ball', name: '장난감 공', emoji: '⚽', category: 'furniture', price: 25, effects: { happiness: 15, bond: 2 }, description: '탱탱한 공' },
  { id: 'scratching-post', name: '스크래쳐', emoji: '🪵', category: 'furniture', price: 45, effects: { happiness: 20, bond: 3 }, description: '고양이 스크래쳐' },
  { id: 'pool', name: '미니 풀장', emoji: '🏊', category: 'furniture', price: 80, effects: { cleanliness: 20, happiness: 15, bond: 4 }, description: '작은 수영장', unlockBond: 200 },
  { id: 'treehouse', name: '나무집', emoji: '🏠', category: 'furniture', price: 150, effects: { happiness: 25, energy: 15, bond: 8 }, description: '아늑한 나무집', unlockBond: 250 },

  // === Premium Food ===
  { id: 'wagyu', name: '와규 스테이크', emoji: '🥩', category: 'food', price: 80, effects: { hunger: 60, happiness: 25, bond: 5 }, description: '최고급 와규', unlockBond: 200 },
  { id: 'sushi', name: '스시 세트', emoji: '🍣', category: 'food', price: 60, effects: { hunger: 50, happiness: 20, bond: 4 }, description: '신선한 스시', unlockBond: 150 },

  // === Premium Snack ===
  { id: 'macaron', name: '마카롱 세트', emoji: '🧁', category: 'snack', price: 50, effects: { happiness: 35, hunger: 10, bond: 4 }, description: '프렌치 마카롱', unlockBond: 100 },
  { id: 'golden-bone', name: '황금 뼈다귀', emoji: '🦴', category: 'snack', price: 100, effects: { happiness: 50, bond: 8 }, description: '전설의 간식', unlockBond: 300 },

  // === Premium Accessory ===
  { id: 'diamond-collar', name: '다이아 목걸이', emoji: '💎', category: 'accessory', price: 500, effects: { happiness: 30, bond: 15 }, description: '빛나는 다이아몬드', unlockBond: 350 },
  { id: 'angel-wings', name: '천사 날개', emoji: '🪽', category: 'accessory', price: 800, effects: { happiness: 40, bond: 20 }, description: '하늘하늘 천사 날개', unlockBond: 400 },
  { id: 'cape', name: '슈퍼히어로 망토', emoji: '🦸', category: 'accessory', price: 300, effects: { happiness: 25, bond: 10 }, description: '멋진 망토', unlockBond: 200 },

  // === Premium Furniture ===
  { id: 'castle', name: '미니 성', emoji: '🏰', category: 'furniture', price: 1000, effects: { happiness: 40, energy: 25, bond: 15 }, description: '웅장한 미니 성', unlockBond: 350 },
  { id: 'garden', name: '실내 정원', emoji: '🌺', category: 'furniture', price: 600, effects: { happiness: 30, cleanliness: 15, bond: 10 }, description: '꽃이 피는 정원', unlockBond: 250 },
  { id: 'playground', name: '놀이공원', emoji: '🎡', category: 'furniture', price: 1500, effects: { happiness: 50, energy: 20, bond: 20 }, description: '미니 놀이공원', unlockBond: 400 },

  // === Room Theme (방 테마) ===
  { id: 'theme-cafe', name: '카페', emoji: '☕', category: 'room-theme', price: 200, effects: { happiness: 5 }, description: '아늑한 카페 분위기' },
  { id: 'theme-space', name: '우주', emoji: '🚀', category: 'room-theme', price: 300, effects: { happiness: 8 }, description: '신비로운 우주 배경' },
  { id: 'theme-forest', name: '숲속', emoji: '🌿', category: 'room-theme', price: 250, effects: { happiness: 6 }, description: '평화로운 숲속' },
  { id: 'theme-pink', name: '핑크룸', emoji: '🎀', category: 'room-theme', price: 350, effects: { happiness: 10 }, description: '산리오 감성 핑크' },
];

export function getItemById(id: string): ItemDef | undefined {
  return ITEMS.find(item => item.id === id);
}

export function getItemsByCategory(category: ItemCategory): ItemDef[] {
  return ITEMS.filter(item => item.category === category);
}
