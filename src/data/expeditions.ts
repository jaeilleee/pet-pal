/**
 * expeditions.ts -- 펫 탐험 임무 시스템 (6개 목적지)
 */

export interface ExpeditionReward {
  type: 'gold' | 'bond' | 'item';
  value: number;
  chance: number;
  label: string;
  /** item 타입일 때 아이템 ID */
  itemId?: string;
}

export interface ExpeditionDef {
  id: string;
  name: string;
  emoji: string;
  durationHours: number;
  rewards: ExpeditionReward[];
  /** adult만 가능한 고급 탐험 */
  requiresAdult?: boolean;
  /** 성격 보너스 */
  bonusPersonality?: string;
}

export const EXPEDITIONS: ExpeditionDef[] = [
  {
    id: 'park', name: '동네 공원', emoji: '🌳', durationHours: 1,
    rewards: [
      { type: 'gold', value: 30, chance: 1.0, label: '30G' },
      { type: 'bond', value: 3, chance: 0.5, label: '유대감+3' },
      { type: 'gold', value: 80, chance: 0.15, label: '보너스 80G!' },
    ],
    bonusPersonality: 'active',
  },
  {
    id: 'market', name: '재래시장', emoji: '🏪', durationHours: 1,
    rewards: [
      { type: 'gold', value: 40, chance: 1.0, label: '40G' },
      { type: 'gold', value: 100, chance: 0.1, label: '대박 100G!' },
    ],
    bonusPersonality: 'foodie',
  },
  {
    id: 'forest', name: '숲 탐험', emoji: '🌲', durationHours: 2,
    rewards: [
      { type: 'gold', value: 60, chance: 1.0, label: '60G' },
      { type: 'bond', value: 5, chance: 0.6, label: '유대감+5' },
      { type: 'gold', value: 150, chance: 0.1, label: '보물 150G!' },
      { type: 'item', value: 0, chance: 0.1, label: '🪶 황금 깃털', itemId: 'feather' },
    ],
    bonusPersonality: 'gentle',
  },
  {
    id: 'beach', name: '바닷가', emoji: '🏖️', durationHours: 2,
    rewards: [
      { type: 'gold', value: 70, chance: 1.0, label: '70G' },
      { type: 'bond', value: 4, chance: 0.5, label: '유대감+4' },
      { type: 'gold', value: 200, chance: 0.08, label: '진주 200G!' },
      { type: 'item', value: 0, chance: 0.15, label: '🐚 소라 껍데기', itemId: 'seashell' },
    ],
    bonusPersonality: 'playful',
  },
  {
    id: 'mountain', name: '산 정상', emoji: '🏔️', durationHours: 4,
    rewards: [
      { type: 'gold', value: 120, chance: 1.0, label: '120G' },
      { type: 'bond', value: 8, chance: 0.7, label: '유대감+8' },
      { type: 'gold', value: 300, chance: 0.1, label: '전설의 보물 300G!' },
      { type: 'item', value: 0, chance: 0.08, label: '🗺️ 보물 지도', itemId: 'treasure-map' },
    ],
    requiresAdult: true,
    bonusPersonality: 'active',
  },
  {
    id: 'dungeon', name: '비밀 동굴', emoji: '🕳️', durationHours: 4,
    rewards: [
      { type: 'gold', value: 100, chance: 1.0, label: '100G' },
      { type: 'bond', value: 10, chance: 0.5, label: '유대감+10' },
      { type: 'gold', value: 500, chance: 0.05, label: '전설 보물 500G!!' },
      { type: 'item', value: 0, chance: 0.05, label: '🔮 수정 구슬', itemId: 'crystal' },
    ],
    requiresAdult: true,
    bonusPersonality: 'sleepy',
  },
];

/** 탐험 보상 롤 결과 */
export interface ExpeditionRollResult {
  label: string;
  type: string;
  value: number;
  itemId?: string;
}

/** 탐험 보상 롤 */
export function rollExpeditionRewards(
  expedition: ExpeditionDef,
  personalityMatch: boolean,
): ExpeditionRollResult[] {
  const results: ExpeditionRollResult[] = [];
  for (const reward of expedition.rewards) {
    const chance = personalityMatch ? Math.min(1, reward.chance * 1.5) : reward.chance;
    if (Math.random() < chance) {
      results.push({
        label: reward.label,
        type: reward.type,
        value: reward.value,
        itemId: reward.itemId,
      });
    }
  }
  return results;
}
