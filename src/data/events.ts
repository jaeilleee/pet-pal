/**
 * events.ts -- 시즌 이벤트 프레임워크
 */

export interface SeasonEvent {
  id: string;
  name: string;
  emoji: string;
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  description: string;
  bonusAction?: string;
  bonusMultiplier?: number;
  specialShopItems?: string[];
}

export const SEASON_EVENTS: SeasonEvent[] = [
  {
    id: 'spring-blossom', name: '벚꽃 축제', emoji: '🌸',
    season: 'spring', description: '산책 보너스 x2!',
    bonusAction: 'walk', bonusMultiplier: 2.0,
  },
  {
    id: 'summer-splash', name: '여름 물놀이', emoji: '🏖️',
    season: 'summer', description: '씻기 보너스 x2!',
    bonusAction: 'clean', bonusMultiplier: 2.0,
  },
  {
    id: 'autumn-harvest', name: '가을 수확제', emoji: '🍂',
    season: 'autumn', description: '먹이 보너스 x2!',
    bonusAction: 'feed', bonusMultiplier: 2.0,
  },
  {
    id: 'winter-cozy', name: '겨울 따뜻한 밤', emoji: '❄️',
    season: 'winter', description: '대화 보너스 x2!',
    bonusAction: 'talk', bonusMultiplier: 2.0,
  },
];

export function getCurrentSeasonEvent(): SeasonEvent | null {
  const month = new Date().getMonth();
  const season: SeasonEvent['season'] =
    month >= 2 && month <= 4 ? 'spring'
    : month >= 5 && month <= 7 ? 'summer'
    : month >= 8 && month <= 10 ? 'autumn'
    : 'winter';
  return SEASON_EVENTS.find(e => e.season === season) ?? null;
}
