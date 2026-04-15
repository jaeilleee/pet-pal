/**
 * Pet definitions -- 반려동물 5종 + 성장 4단계
 */

export type PetType = 'dog' | 'cat' | 'bird' | 'pig' | 'reptile';
export type GrowthStage = 'baby' | 'child' | 'teen' | 'adult';
export type Personality = 'active' | 'foodie' | 'gentle' | 'playful' | 'sleepy';

export interface PetStageInfo {
  emoji: string;
  name: string;
  size: number; // px
  description: string;
}

export interface PetDef {
  type: PetType;
  name: string;
  color: string;
  bgColor: string;
  description: string;
  trait: string;
  uniqueActivity: string;
  stages: Record<GrowthStage, PetStageInfo>;
  /** 유대감 누적량으로 다음 스테이지 진화 */
  evolutionThresholds: [number, number, number]; // baby→child, child→teen, teen→adult
}

export const PETS: Record<PetType, PetDef> = {
  dog: {
    type: 'dog',
    name: '강아지',
    color: '#D4A574',
    bgColor: '#FFF3E0',
    description: '충성스럽고 활발한 친구',
    trait: '산책을 좋아해요',
    uniqueActivity: '공놀이',
    stages: {
      baby: { emoji: '🐶', name: '아기 강아지', size: 60, description: '말랑말랑한 아기 강아지' },
      child: { emoji: '🐕', name: '꼬마 강아지', size: 80, description: '호기심 가득한 강아지' },
      teen: { emoji: '🦮', name: '청소년 강아지', size: 100, description: '에너지 넘치는 강아지' },
      adult: { emoji: '🐕‍🦺', name: '멋진 강아지', size: 120, description: '듬직한 반려견' },
    },
    evolutionThresholds: [50, 150, 350],
  },
  cat: {
    type: 'cat',
    name: '고양이',
    color: '#A0A0A0',
    bgColor: '#F3E5F5',
    description: '도도하지만 애교 많은 친구',
    trait: '그루밍을 좋아해요',
    uniqueActivity: '낚싯대놀이',
    stages: {
      baby: { emoji: '🐱', name: '아기 고양이', size: 55, description: '작고 귀여운 아기 고양이' },
      child: { emoji: '😺', name: '꼬마 고양이', size: 75, description: '장난꾸러기 고양이' },
      teen: { emoji: '🐈', name: '청소년 고양이', size: 95, description: '우아한 고양이' },
      adult: { emoji: '🐈‍⬛', name: '어른 고양이', size: 115, description: '기품있는 고양이' },
    },
    evolutionThresholds: [45, 140, 320],
  },
  bird: {
    type: 'bird',
    name: '새',
    color: '#FFD54F',
    bgColor: '#E3F2FD',
    description: '수다스럽고 밝은 친구',
    trait: '노래를 좋아해요',
    uniqueActivity: '노래 따라하기',
    stages: {
      baby: { emoji: '🐣', name: '병아리', size: 45, description: '알에서 갓 나온 병아리' },
      child: { emoji: '🐥', name: '꼬마 새', size: 65, description: '날갯짓을 연습하는 새' },
      teen: { emoji: '🐦', name: '청소년 새', size: 80, description: '노래를 배우는 새' },
      adult: { emoji: '🦜', name: '앵무새', size: 100, description: '화려한 깃털의 새' },
    },
    evolutionThresholds: [40, 120, 280],
  },
  pig: {
    type: 'pig',
    name: '돼지',
    color: '#F8BBD0',
    bgColor: '#FCE4EC',
    description: '먹보지만 애교쟁이',
    trait: '간식을 좋아해요',
    uniqueActivity: '트러플 찾기',
    stages: {
      baby: { emoji: '🐷', name: '아기 돼지', size: 55, description: '분홍빛 아기 돼지' },
      child: { emoji: '🐖', name: '꼬마 돼지', size: 80, description: '통통한 꼬마 돼지' },
      teen: { emoji: '🐽', name: '청소년 돼지', size: 100, description: '애교 만점 돼지' },
      adult: { emoji: '🐗', name: '멧돼지', size: 120, description: '씩씩한 어른 돼지' },
    },
    evolutionThresholds: [55, 160, 380],
  },
  reptile: {
    type: 'reptile',
    name: '파충류',
    color: '#81C784',
    bgColor: '#E8F5E9',
    description: '쿨하고 느긋한 친구',
    trait: '일광욕을 좋아해요',
    uniqueActivity: '곤충사냥',
    stages: {
      baby: { emoji: '🦎', name: '아기 도마뱀', size: 45, description: '꼬물꼬물 아기 도마뱀' },
      child: { emoji: '🐊', name: '꼬마 악어', size: 70, description: '자라나는 악어' },
      teen: { emoji: '🐉', name: '청소년 드래곤', size: 95, description: '날개가 돋는 드래곤' },
      adult: { emoji: '🐲', name: '드래곤', size: 120, description: '위풍당당한 드래곤' },
    },
    evolutionThresholds: [60, 180, 400],
  },
};

export const PET_TYPES: PetType[] = ['dog', 'cat', 'bird', 'pig', 'reptile'];

// === Pet Synergies ===

export interface PetSynergy {
  types: PetType[];
  name: string;
  emoji: string;
  bonus: string;
}

export const PET_SYNERGIES: PetSynergy[] = [
  { types: ['dog', 'cat'], name: '으르렁 친구', emoji: '🐾', bonus: 'happiness +5% 상시' },
  { types: ['bird', 'reptile'], name: '하늘과 땅', emoji: '🌍', bonus: 'bond +10% 상시' },
  { types: ['pig', 'dog'], name: '먹방 콤비', emoji: '🍽️', bonus: 'hunger decay -20%' },
  { types: ['cat', 'bird'], name: '사냥 본능', emoji: '🎯', bonus: 'energy +5% 상시' },
  { types: ['dog', 'cat', 'bird'], name: '동물농장', emoji: '🏡', bonus: '전체 +10%' },
];

/** 현재 보유 펫 타입 목록에서 활성 시너지 필터 */
export function getActiveSynergies(petTypes: PetType[]): PetSynergy[] {
  return PET_SYNERGIES.filter(s => s.types.every(t => petTypes.includes(t)));
}

/** 유대감 수치로 현재 성장 단계 계산 */
export function getGrowthStage(petType: PetType, bond: number): GrowthStage {
  const thresholds = PETS[petType].evolutionThresholds;
  if (bond >= thresholds[2]) return 'adult';
  if (bond >= thresholds[1]) return 'teen';
  if (bond >= thresholds[0]) return 'child';
  return 'baby';
}

/** 다음 진화까지 남은 유대감 (adult면 0) */
export function bondToNextStage(petType: PetType, bond: number): number {
  const thresholds = PETS[petType].evolutionThresholds;
  for (const t of thresholds) {
    if (bond < t) return t - bond;
  }
  return 0;
}

// === Pet Skill Tree (adult 이후 엔드게임) ===

export interface PetSkill {
  id: string;
  name: string;
  emoji: string;
  description: string;
  bondRequired: number; // adult 진화 후 추가 bond
  effect: string; // 효과 코드 키
}

export const PET_SKILLS: Record<PetType, PetSkill[]> = {
  dog: [
    { id: 'treasure-nose', name: '보물 코', emoji: '👃', description: '탐험 보상 +30%', bondRequired: 450, effect: 'expedition_bonus_30' },
    { id: 'loyal-guard', name: '충성 지킴이', emoji: '🛡️', description: '다른 펫 질투 감소 50%', bondRequired: 550, effect: 'jealousy_reduce_50' },
    { id: 'fetch-master', name: '물어오기 달인', emoji: '🦴', description: '미니게임 점수 +20%', bondRequired: 700, effect: 'minigame_bonus_20' },
  ],
  cat: [
    { id: 'lucky-paw', name: '행운의 발', emoji: '🍀', description: '럭키 드롭 확률 2배', bondRequired: 420, effect: 'lucky_drop_2x' },
    { id: 'night-vision', name: '야간 시력', emoji: '🌙', description: '밤 시간 bond +50%', bondRequired: 530, effect: 'night_bond_50' },
    { id: 'cat-charm', name: '고양이 매력', emoji: '✨', description: '방문자 출현 +50%', bondRequired: 680, effect: 'visitor_bonus_50' },
  ],
  bird: [
    { id: 'morning-song', name: '아침 노래', emoji: '🎵', description: '아침 행복 보너스 +10', bondRequired: 380, effect: 'morning_happy_10' },
    { id: 'sky-scout', name: '하늘 정찰', emoji: '🔭', description: '탐험 시간 -20%', bondRequired: 480, effect: 'expedition_time_reduce' },
    { id: 'feather-dance', name: '깃털 춤', emoji: '💃', description: '모든 스탯 보너스 +10%', bondRequired: 650, effect: 'all_stats_10' },
  ],
  pig: [
    { id: 'truffle-finder', name: '트러플 탐지', emoji: '🍄', description: '탐험 전리품 확률 2배', bondRequired: 460, effect: 'expedition_item_2x' },
    { id: 'foodie-boost', name: '미식가', emoji: '🍽️', description: '먹이 효과 +50%', bondRequired: 560, effect: 'feed_bonus_50' },
    { id: 'piggy-bank', name: '돼지 저금통', emoji: '🐖', description: '모든 골드 획득 +20%', bondRequired: 720, effect: 'gold_bonus_20' },
  ],
  reptile: [
    { id: 'sun-power', name: '태양의 힘', emoji: '☀️', description: '낮 에너지 감소 -50%', bondRequired: 500, effect: 'day_energy_save' },
    { id: 'dragon-breath', name: '드래곤 브레스', emoji: '🔥', description: '미니게임 라이프 +1', bondRequired: 600, effect: 'minigame_life_1' },
    { id: 'ancient-wisdom', name: '고대의 지혜', emoji: '📜', description: '모든 bond +20%', bondRequired: 750, effect: 'bond_bonus_20' },
  ],
};

/** 해금된 스킬 목록 반환 */
export function getUnlockedSkills(petType: PetType, bond: number): PetSkill[] {
  return PET_SKILLS[petType].filter(s => bond >= s.bondRequired);
}

/** 특정 스킬 효과 보유 여부 */
export function hasSkill(petType: PetType, bond: number, skillEffect: string): boolean {
  return PET_SKILLS[petType].some(s => bond >= s.bondRequired && s.effect === skillEffect);
}
