/**
 * PetPalState -- 게임 세이브 상태 정의
 */

import type { PetType, Personality } from './pets';
import type { DailyTask } from './daily';

export const STATE_VERSION = 1;

export interface PetStats {
  hunger: number;     // 0-100 (0=배고픔, 100=배부름)
  happiness: number;  // 0-100
  cleanliness: number; // 0-100
  energy: number;     // 0-100
  bond: number;       // 0+ (누적, 진화 기준)
}

export interface PetPalState {
  version: number;

  // === Pet ===
  petType: PetType | null;
  petName: string;
  petStats: PetStats;
  personality: Personality;
  /** 마지막 스탯 감소 시각 (ms) */
  lastDecayAt: number;

  // === Economy ===
  gold: number;
  totalGoldEarned: number;
  ownedItems: string[];       // item ids
  equippedAccessory: string | null;
  ownedFurniture: string[];   // item ids

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
  lastLoginDate: string;  // ISO YYYY-MM-DD
  streak: number;
  bestStreak: number;
  loginChainDay: number;  // 1-7
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
  date: string;   // ISO
  emoji: string;
  text: string;
}

export function createInitialState(): PetPalState {
  return {
    version: STATE_VERSION,
    petType: null,
    petName: '',
    petStats: { hunger: 80, happiness: 80, cleanliness: 80, energy: 80, bond: 0 },
    personality: 'playful',
    lastDecayAt: Date.now(),

    gold: 100,
    totalGoldEarned: 100,
    ownedItems: [],
    equippedAccessory: null,
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

/** 시간 경과에 따른 스탯 감소 */
export function decayStats(state: PetPalState): PetPalState {
  const now = Date.now();
  const elapsed = now - state.lastDecayAt;
  const minutes = elapsed / (1000 * 60);

  // 10분마다 1포인트씩 감소
  if (minutes < 10) return state;

  const decayTicks = Math.floor(minutes / 10);
  const decay = Math.min(decayTicks, 10); // 최대 10포인트 한번에

  const stats = { ...state.petStats };
  stats.hunger = Math.max(0, stats.hunger - decay * 2);
  stats.happiness = Math.max(0, stats.happiness - decay * 1.5);
  stats.cleanliness = Math.max(0, stats.cleanliness - decay);
  stats.energy = Math.max(0, stats.energy - decay * 0.8);

  return {
    ...state,
    petStats: stats,
    lastDecayAt: now,
  };
}

/** 스탯 적용 (효과 아이템 사용) */
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

/** 펫 전체 상태 점수 (0-100) */
export function overallMood(stats: PetStats): number {
  return Math.round(
    (stats.hunger + stats.happiness + stats.cleanliness + stats.energy) / 4
  );
}

/** 펫 기분 이모지 */
export function moodEmoji(stats: PetStats): string {
  const mood = overallMood(stats);
  if (mood >= 80) return '😊';
  if (mood >= 60) return '🙂';
  if (mood >= 40) return '😐';
  if (mood >= 20) return '😟';
  return '😢';
}

/** 일기 자동 생성 */
export function generateDiaryEntry(state: PetPalState): DiaryEntry {
  const mood = overallMood(state.petStats);
  const entries = [
    { min: 80, emoji: '😊', texts: ['오늘 너무 행복했어!', '최고의 하루!', '주인이 많이 놀아줬어~'] },
    { min: 60, emoji: '🙂', texts: ['오늘 괜찮은 하루였어', '즐거운 하루!', '산책이 좋았어'] },
    { min: 40, emoji: '😐', texts: ['오늘은 그냥 그랬어...', '좀 심심했어', '배가 고팠어'] },
    { min: 20, emoji: '😟', texts: ['오늘 좀 외로웠어...', '주인이 보고싶어', '기운이 없어'] },
    { min: 0, emoji: '😢', texts: ['많이 슬펐어...', '아무도 안 놀아줘', '배고파...'] },
  ];

  const match = entries.find(e => mood >= e.min) ?? entries[entries.length - 1];
  const text = match.texts[Math.floor(Math.random() * match.texts.length)];

  return {
    date: new Date().toISOString().slice(0, 10),
    emoji: match.emoji,
    text,
  };
}
