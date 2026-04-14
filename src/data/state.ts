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
  /** 아픈 상태 (스탯 합계 < 100이면 30% 확률 발동) */
  isSick: boolean;
  /** 아픈 시작 시각 (ms) */
  sickSince: number;
  /** 가출 경고 표시됨 여부 */
  runawayWarned: boolean;
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

  // === Visitor System ===
  /** 방문한 visitor id 목록 (도감용) */
  visitorLog: string[];
  /** 현재 방문 중인 방문자 */
  currentVisitor: { id: string; arrivedAt: number } | null;

  // === Expedition System ===
  /** 탐험 중인 펫 정보 */
  expeditions: Array<{
    petIndex: number;
    expeditionId: string;
    startedAt: number;
    durationMs: number;
  }>;

  // === Weekly Tournament ===
  weeklyBestScore: number;
  weeklyStartDate: string;  // ISO 주 시작일 (월요일)
  weeklyTier: 'none' | 'bronze' | 'silver' | 'gold' | 'diamond';

  // === Room Theme ===
  activeRoomTheme: string | null;
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
    isSick: false,
    sickSince: 0,
    runawayWarned: false,
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
    visitorLog: [],
    currentVisitor: null,
    expeditions: [],
    weeklyBestScore: 0,
    weeklyStartDate: '',
    weeklyTier: 'none',
    activeRoomTheme: null,
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
      isSick: typeof p.isSick === 'boolean' ? p.isSick : false,
      sickSince: typeof p.sickSince === 'number' ? p.sickSince : 0,
      runawayWarned: typeof p.runawayWarned === 'boolean' ? p.runawayWarned : false,
    }));
    // visitor 시스템 마이그레이션
    if (!Array.isArray(base.visitorLog)) base.visitorLog = [];
    if (base.currentVisitor === undefined) base.currentVisitor = null;
    // expedition 시스템 마이그레이션
    if (!Array.isArray(base.expeditions)) base.expeditions = [];
    // weekly tournament 마이그레이션
    if (typeof base.weeklyBestScore !== 'number') base.weeklyBestScore = 0;
    if (typeof base.weeklyStartDate !== 'string') base.weeklyStartDate = '';
    if (!base.weeklyTier) base.weeklyTier = 'none';
    // room theme 마이그레이션
    if (base.activeRoomTheme === undefined) base.activeRoomTheme = null;
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
      isSick: false,
      sickSince: 0,
      runawayWarned: false,
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
    stats.hunger = Math.max(5, stats.hunger - decay * 1.5);
    stats.happiness = Math.max(5, stats.happiness - decay * 1.2);
    stats.cleanliness = Math.max(5, stats.cleanliness - decay * 0.8);
    stats.energy = Math.max(5, stats.energy - decay * 0.6);

    // sick이면 bond도 접속마다 감소
    if (pet.isSick) {
      stats.bond = Math.max(0, stats.bond - 1);
    }

    // 질투도 시간 경과로 빠르게 감소
    const jealousy = Math.max(0, pet.jealousy - decay * 5);
    return { ...pet, stats, jealousy };
  });

  return { ...state, pets, lastDecayAt: now };
}

/** 접속 시 질병 체크: overallMood < 25이면 30% 확률로 발병 */
export function checkSickness(pet: PetData): PetData {
  if (pet.isSick) return pet; // 이미 아픔
  const mood = overallMood(pet.stats);
  if (mood < 25 && Math.random() < 0.3) {
    return { ...pet, isSick: true, sickSince: Date.now() };
  }
  return pet;
}

/** 치료 (50G) */
export function healPet(pet: PetData): PetData {
  return {
    ...pet,
    isSick: false,
    sickSince: 0,
    runawayWarned: false,
    stats: { ...pet.stats, bond: pet.stats.bond + 10 },
  };
}

/** 가출 경고 체크: 24시간 이상 sick 방치 */
export function checkRunawayWarning(pet: PetData): { pet: PetData; warn: boolean } {
  if (!pet.isSick || pet.runawayWarned) return { pet, warn: false };
  const sickHours = (Date.now() - pet.sickSince) / (1000 * 60 * 60);
  if (sickHours >= 24) {
    return { pet: { ...pet, runawayWarned: true }, warn: true };
  }
  return { pet, warn: false };
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
  // sick이면 모든 긍정 효과 50% 감소
  const sickPenalty = pet.isSick ? 0.5 : 1.0;

  const stats = { ...pet.stats };
  for (const [key, value] of Object.entries(effects)) {
    const k = key as keyof PetStats;
    const baseMult = value > 0 ? mult * sickPenalty : 1;
    const adjusted = k === 'bond' ? Math.round(value * baseMult) : value * baseMult;
    if (k === 'bond') {
      stats.bond += adjusted;
    } else {
      stats[k] = Math.min(100, Math.max(0, stats[k] + adjusted));
    }
  }
  pet.stats = stats;

  // 질투: 돌봄 받은 펫은 질투 감소, 나머지는 소폭 증가
  for (let i = 0; i < pets.length; i++) {
    if (i === petIndex) {
      pet.jealousy = Math.max(0, pet.jealousy - 10);
      pets[i] = pet;
    } else {
      const other = { ...pets[i] };
      other.jealousy = Math.min(100, other.jealousy + 3);
      if (other.jealousy > 60) {
        other.stats = { ...other.stats };
        other.stats.happiness = Math.max(10, other.stats.happiness - 1);
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

/** 행동 패턴 기반 펫 칭호 */
export function getActivePetTitle(pet: PetData, state: PetPalState): string {
  if (state.streak > 14) return '개근상 🔥';
  if (state.miniGameHighScore > 200) return '게임왕 🎮';
  if (pet.stats.bond > 200) return '사랑둥이 💕';
  if (state.totalWalks > 20) return '산책러 🚶';
  // totalFeeds가 다른 행동보다 많으면 먹보왕
  const maxAction = Math.max(state.totalPlays, state.totalWalks, state.totalBaths, state.totalTalks);
  if (state.totalFeeds > maxAction && state.totalFeeds > 10) return '먹보왕 👑';
  return '귀요미 ✨';
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
