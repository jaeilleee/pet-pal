/**
 * PetPalState -- 멀티펫 지원 게임 상태 (v2)
 */

import type { PetType, Personality } from './pets';
import { PETS } from './pets';
import type { DailyTask } from './daily';

export const STATE_VERSION = 2;
export const MAX_PETS = 3;

/** 펫 슬롯 해금 비용 */
export const PET_SLOT_COSTS = [0, 300, 1500];

export interface PetStats {
  hunger: number;     // 0-100
  happiness: number;  // 0-100
  cleanliness: number; // 0-100
  energy: number;     // 0-100
  bond: number;       // 0+ (누적)
}

/** 개별 펫 데이터 */
export interface PetData {
  id: number;
  type: PetType;
  name: string;
  stats: PetStats;
  personality: Personality;
  equippedAccessory: string | null;
  joinedDate: string;
  /** 질투 수치 0-100 (다른 펫에 관심 줄 때 증가) */
  jealousy: number;
}

export interface PetPalState {
  version: number;

  // === Multi-Pet ===
  pets: PetData[];
  activePetIndex: number;  // 현재 선택된 펫 인덱스
  unlockedSlots: number;   // 해금된 슬롯 수 (1-3)

  // === Legacy compat (v1→v2 마이그레이션용) ===
  petType?: PetType | null;
  petName?: string;
  petStats?: PetStats;
  personality?: Personality;
  equippedAccessory?: string | null;

  /** 마지막 스탯 감소 시각 (ms) */
  lastDecayAt: number;

  // === Economy ===
  gold: number;
  totalGoldEarned: number;
  ownedItems: string[];
  ownedFurniture: string[];

  // === Progress ===
  totalFeeds: number;
  totalPlays: number;
  totalWalks: number;
  totalBaths: number;
  totalTalks: number;
  totalMiniGamesPlayed: number;
  miniGameHighScore: number;
  achievements: Record<string, boolean>;

  // === Daily / Login ===
  lastLoginDate: string;
  streak: number;
  bestStreak: number;
  loginChainDay: number;
  dailyTasks: DailyTask[];
  dailyTaskDate: string;
  dailyTasksClaimed: boolean;

  // === Anti-cheat ===
  maxSeenDateISO: string;

  // === Tutorial ===
  tutorialShown: boolean;

  // === Session ===
  sessionStartedAt: number;
  lastReviewRequestAt: number;

  // === Diary ===
  diaryEntries: DiaryEntry[];
}

export interface DiaryEntry {
  date: string;
  emoji: string;
  text: string;
  petName?: string;
}

export function createInitialStats(): PetStats {
  return { hunger: 80, happiness: 80, cleanliness: 80, energy: 80, bond: 0 };
}

export function createPetData(type: PetType, name: string, id: number): PetData {
  const defaultPersonalities: Record<PetType, Personality> = {
    dog: 'active', cat: 'gentle', bird: 'playful', pig: 'foodie', reptile: 'sleepy',
  };
  return {
    id,
    type,
    name,
    stats: createInitialStats(),
    personality: defaultPersonalities[type],
    equippedAccessory: null,
    joinedDate: new Date().toISOString().slice(0, 10),
    jealousy: 0,
  };
}

export function createInitialState(): PetPalState {
  return {
    version: STATE_VERSION,
    pets: [],
    activePetIndex: 0,
    unlockedSlots: 1,
    lastDecayAt: Date.now(),

    gold: 150,
    totalGoldEarned: 150,
    ownedItems: [],
    ownedFurniture: [],

    totalFeeds: 0,
    totalPlays: 0,
    totalWalks: 0,
    totalBaths: 0,
    totalTalks: 0,
    totalMiniGamesPlayed: 0,
    miniGameHighScore: 0,
    achievements: {},

    lastLoginDate: '',
    streak: 0,
    bestStreak: 0,
    loginChainDay: 0,
    dailyTasks: [],
    dailyTaskDate: '',
    dailyTasksClaimed: false,

    maxSeenDateISO: '',
    tutorialShown: false,
    sessionStartedAt: Date.now(),
    lastReviewRequestAt: 0,
    diaryEntries: [],
  };
}

/** 현재 활성 펫 (편의 getter) */
export function getActivePet(state: PetPalState): PetData | null {
  return state.pets[state.activePetIndex] ?? null;
}

/** 현재 활성 펫 스탯 (편의 getter) */
export function getActiveStats(state: PetPalState): PetStats {
  return getActivePet(state)?.stats ?? createInitialStats();
}

/** petStats 마이그레이션 */
export function migratePetStats(raw: Partial<PetStats> | undefined): PetStats {
  const defaults = createInitialStats();
  if (!raw) return defaults;
  return {
    hunger: typeof raw.hunger === 'number' ? raw.hunger : defaults.hunger,
    happiness: typeof raw.happiness === 'number' ? raw.happiness : defaults.happiness,
    cleanliness: typeof raw.cleanliness === 'number' ? raw.cleanliness : defaults.cleanliness,
    energy: typeof raw.energy === 'number' ? raw.energy : defaults.energy,
    bond: typeof raw.bond === 'number' ? raw.bond : defaults.bond,
  };
}

/** v1→v2 마이그레이션 (단일펫→멀티펫) */
export function migrateV1toV2(raw: Record<string, unknown>): PetPalState {
  const base = { ...createInitialState(), ...raw };

  // 이미 v2면 스킵 (빈 배열도 v2)
  if (Array.isArray(base.pets)) {
    base.version = STATE_VERSION;
    // pets 내부 마이그레이션
    base.pets = (base.pets as PetData[]).map(p => ({
      ...p,
      stats: migratePetStats(p.stats),
      jealousy: typeof p.jealousy === 'number' ? p.jealousy : 0,
      joinedDate: p.joinedDate ?? '',
    }));
    return base as PetPalState;
  }

  // v1 → v2 변환
  const oldType = raw.petType as PetType | null;
  const oldName = raw.petName as string;
  const oldStats = migratePetStats(raw.petStats as Partial<PetStats> | undefined);
  const oldPersonality = (raw.personality as Personality) ?? 'playful';
  const oldAccessory = (raw.equippedAccessory as string) ?? null;

  const pets: PetData[] = [];
  if (oldType) {
    pets.push({
      id: 1,
      type: oldType,
      name: oldName || '펫',
      stats: oldStats,
      personality: oldPersonality,
      equippedAccessory: oldAccessory,
      joinedDate: '',
      jealousy: 0,
    });
  }

  return {
    ...(base as PetPalState),
    version: STATE_VERSION,
    pets,
    activePetIndex: 0,
    unlockedSlots: 1,
  };
}

/** 성격별 스탯 보너스 배율 */
const PERSONALITY_BONUS: Record<Personality, Partial<Record<string, number>>> = {
  active: { walk: 1.5, play: 1.3 },
  foodie: { feed: 1.5, snack: 1.3 },
  gentle: { talk: 1.5, clean: 1.3 },
  playful: { play: 1.5, feed: 1.2 },
  sleepy: { clean: 1.3, talk: 1.2 },
};

/** 성격 보너스 적용된 효과 계산 */
export function getPersonalityMultiplier(personality: Personality, action: string): number {
  return (PERSONALITY_BONUS[personality]?.[action] as number) ?? 1.0;
}

/** 모든 펫 스탯 감소 */
export function decayAllPets(state: PetPalState): PetPalState {
  const now = Date.now();
  const elapsed = now - state.lastDecayAt;
  const minutes = elapsed / (1000 * 60);
  if (minutes < 10) return state;

  const decayTicks = Math.floor(minutes / 10);
  const decay = Math.min(decayTicks, 6);

  const pets = state.pets.map(pet => {
    const stats = { ...pet.stats };
    stats.hunger = Math.max(15, stats.hunger - decay * 1.5);
    stats.happiness = Math.max(15, stats.happiness - decay * 1.2);
    stats.cleanliness = Math.max(15, stats.cleanliness - decay * 0.8);
    stats.energy = Math.max(10, stats.energy - decay * 0.6);
    // 질투도 시간 경과로 감소
    const jealousy = Math.max(0, pet.jealousy - decay * 2);
    return { ...pet, stats, jealousy };
  });

  return { ...state, pets, lastDecayAt: now };
}

/** 특정 펫에 효과 적용 */
export function applyEffectsToPet(
  state: PetPalState,
  petIndex: number,
  effects: Partial<Record<keyof PetStats, number>>,
  action?: string,
): PetPalState {
  const pets = [...state.pets];
  const pet = { ...pets[petIndex] };
  const mult = action ? getPersonalityMultiplier(pet.personality, action) : 1.0;

  const stats = { ...pet.stats };
  for (const [key, value] of Object.entries(effects)) {
    const k = key as keyof PetStats;
    const adjusted = k === 'bond' ? Math.round(value * mult) : value * (value > 0 ? mult : 1);
    if (k === 'bond') {
      stats.bond += adjusted;
    } else {
      stats[k] = Math.min(100, Math.max(0, stats[k] + adjusted));
    }
  }
  pet.stats = stats;

  // 질투: 다른 펫들의 질투 증가
  for (let i = 0; i < pets.length; i++) {
    if (i === petIndex) {
      pets[i] = pet;
    } else {
      const other = { ...pets[i] };
      other.jealousy = Math.min(100, other.jealousy + 8);
      // 질투가 높으면 행복 감소
      if (other.jealousy > 50) {
        other.stats = { ...other.stats };
        other.stats.happiness = Math.max(10, other.stats.happiness - 2);
      }
      pets[i] = other;
    }
  }

  return { ...state, pets };
}

/** 스탯 적용 (레거시 호환) */
export function applyEffects(
  stats: PetStats,
  effects: Partial<Record<keyof PetStats, number>>,
): PetStats {
  const result = { ...stats };
  for (const [key, value] of Object.entries(effects)) {
    const k = key as keyof PetStats;
    if (k === 'bond') {
      result.bond += value;
    } else {
      result[k] = Math.min(100, Math.max(0, result[k] + value));
    }
  }
  return result;
}

export function overallMood(stats: PetStats): number {
  return Math.round((stats.hunger + stats.happiness + stats.cleanliness + stats.energy) / 4);
}

export function moodEmoji(stats: PetStats): string {
  const mood = overallMood(stats);
  if (mood >= 80) return '😊';
  if (mood >= 60) return '🙂';
  if (mood >= 40) return '😐';
  if (mood >= 20) return '😟';
  return '😢';
}

export function generateDiaryEntry(pet: PetData): DiaryEntry {
  const mood = overallMood(pet.stats);
  const entries = [
    { min: 80, emoji: '😊', texts: ['오늘 너무 행복했어!', '최고의 하루!', '주인이 많이 놀아줬어~'] },
    { min: 60, emoji: '🙂', texts: ['오늘 괜찮은 하루였어', '즐거운 하루!', '산책이 좋았어'] },
    { min: 40, emoji: '😐', texts: ['오늘은 그냥 그랬어...', '좀 심심했어', '배가 고팠어'] },
    { min: 20, emoji: '😟', texts: ['오늘 좀 외로웠어...', '주인이 보고싶어', '기운이 없어'] },
    { min: 0, emoji: '😢', texts: ['많이 슬펐어...', '아무도 안 놀아줘', '배고파...'] },
  ];
  const match = entries.find(e => mood >= e.min) ?? entries[entries.length - 1];
  const text = match.texts[Math.floor(Math.random() * match.texts.length)];
  return { date: new Date().toISOString().slice(0, 10), emoji: match.emoji, text, petName: pet.name };
}
