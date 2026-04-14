/**
 * Daily -- 로그인 체인 + 데일리 태스크
 */

import { safeTodayISO, isClockHealthy, isSameDay, isYesterday } from './time-guard';
import type { PetPalState } from './state';

/** 7일 로그인 체인 보상 */
export const LOGIN_CHAIN_REWARDS = [30, 50, 80, 120, 180, 250, 500];

/** 연속 출석 마일스톤 보상 */
export const STREAK_MILESTONES: Array<[number, number]> = [
  [7, 100], [14, 200], [30, 500], [60, 1000],
  [100, 2000], [200, 5000], [365, 10000],
];

export type DailyTaskType = 'feed' | 'play' | 'walk' | 'clean' | 'talk';

export interface DailyTask {
  type: DailyTaskType;
  target: number;
  progress: number;
  reward: number;
  label: string;
  emoji: string;
}

const DAILY_TASK_TEMPLATES: Array<Omit<DailyTask, 'progress'>> = [
  { type: 'feed', target: 3, reward: 20, label: '먹이 주기', emoji: '🍖' },
  { type: 'play', target: 2, reward: 25, label: '놀아주기', emoji: '🎾' },
  { type: 'walk', target: 1, reward: 30, label: '산책하기', emoji: '🚶' },
  { type: 'clean', target: 2, reward: 20, label: '씻기기', emoji: '🛁' },
  { type: 'talk', target: 3, reward: 15, label: '대화하기', emoji: '💬' },
];

/** 오늘의 데일리 태스크 3개 생성 (날짜 시드 기반) */
export function generateDailyTasks(dateISO: string): DailyTask[] {
  const seed = hashDate(dateISO);
  const shuffled = [...DAILY_TASK_TEMPLATES].sort((a, b) => {
    return ((hashDate(dateISO + a.type) % 100) - (hashDate(dateISO + b.type) % 100));
  });
  const selected = shuffled.slice(0, 3);
  return selected.map(t => ({
    ...t,
    target: t.target + (seed % 2),
    progress: 0,
  }));
}

function hashDate(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** 로그인 체인 처리 */
export function processLogin(state: PetPalState): {
  state: PetPalState;
  reward: number;
  chainDay: number;
  streakMilestone: number | null;
} {
  const today = safeTodayISO();
  if (!isClockHealthy(state.maxSeenDateISO)) {
    return { state, reward: 0, chainDay: 0, streakMilestone: null };
  }

  if (isSameDay(state.lastLoginDate)) {
    return { state, reward: 0, chainDay: state.loginChainDay, streakMilestone: null };
  }

  const isConsecutive = isYesterday(state.lastLoginDate) || state.lastLoginDate === '';
  const newStreak = isConsecutive ? state.streak + 1 : 1;
  const chainDay = isConsecutive ? (state.loginChainDay % 7) + 1 : 1;
  const reward = LOGIN_CHAIN_REWARDS[chainDay - 1] ?? 30;

  let streakMilestone: number | null = null;
  for (const [days, bonus] of STREAK_MILESTONES) {
    if (newStreak === days) {
      streakMilestone = bonus;
      break;
    }
  }

  const newState: PetPalState = {
    ...state,
    lastLoginDate: today,
    streak: newStreak,
    bestStreak: Math.max(state.bestStreak, newStreak),
    loginChainDay: chainDay,
    gold: state.gold + reward + (streakMilestone ?? 0),
    maxSeenDateISO: today > state.maxSeenDateISO ? today : state.maxSeenDateISO,
  };

  // 데일리 태스크 리셋
  if (state.dailyTaskDate !== today) {
    newState.dailyTasks = generateDailyTasks(today);
    newState.dailyTaskDate = today;
    newState.dailyTasksClaimed = false;
  }

  return { state: newState, reward, chainDay, streakMilestone };
}

/** 데일리 태스크 진행 */
export function updateDailyProgress(
  state: PetPalState,
  taskType: DailyTaskType,
  amount: number = 1,
): PetPalState {
  const tasks = state.dailyTasks.map(t => {
    if (t.type !== taskType) return t;
    return { ...t, progress: Math.min(t.progress + amount, t.target) };
  });
  return { ...state, dailyTasks: tasks };
}

/** 모든 데일리 완료 여부 */
export function allDailyTasksDone(state: PetPalState): boolean {
  return state.dailyTasks.every(t => t.progress >= t.target);
}

/** 데일리 완료 보상 총합 */
export function getDailyRewardTotal(state: PetPalState): number {
  return state.dailyTasks.reduce((sum, t) => sum + t.reward, 0);
}

// === Weekly Tournament ===

export type WeeklyTier = 'none' | 'bronze' | 'silver' | 'gold' | 'diamond';

const WEEKLY_TIER_THRESHOLDS: Array<{ tier: WeeklyTier; minScore: number; reward: number }> = [
  { tier: 'diamond', minScore: 400, reward: 800 },
  { tier: 'gold', minScore: 200, reward: 300 },
  { tier: 'silver', minScore: 100, reward: 150 },
  { tier: 'bronze', minScore: 50, reward: 50 },
];

/** 현재 주의 월요일 ISO 날짜 */
export function getCurrentWeekStartISO(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const day = kst.getUTCDay();
  const diff = day === 0 ? 6 : day - 1; // 월요일=0
  kst.setUTCDate(kst.getUTCDate() - diff);
  return kst.toISOString().slice(0, 10);
}

/** 점수로 티어 계산 */
export function calcWeeklyTier(score: number): WeeklyTier {
  for (const t of WEEKLY_TIER_THRESHOLDS) {
    if (score >= t.minScore) return t.tier;
  }
  return 'none';
}

/** 티어 이모지 */
export function getWeeklyTierEmoji(tier: WeeklyTier): string {
  switch (tier) {
    case 'diamond': return '💎';
    case 'gold': return '🥇';
    case 'silver': return '🥈';
    case 'bronze': return '🥉';
    default: return '';
  }
}

/** 티어 보상 금액 */
export function getWeeklyTierReward(tier: WeeklyTier): number {
  const found = WEEKLY_TIER_THRESHOLDS.find(t => t.tier === tier);
  return found?.reward ?? 0;
}

/** 주간 리셋 처리: 새 주가 시작되면 보상 지급 + 리셋 */
export function processWeeklyReset(state: PetPalState): {
  state: PetPalState;
  reward: number;
  prevTier: WeeklyTier;
} {
  const currentWeek = getCurrentWeekStartISO();
  if (state.weeklyStartDate === currentWeek) {
    return { state, reward: 0, prevTier: 'none' };
  }

  // 이전 주 보상 지급
  const prevTier = state.weeklyTier;
  const reward = getWeeklyTierReward(prevTier);

  const newState: PetPalState = {
    ...state,
    weeklyBestScore: 0,
    weeklyStartDate: currentWeek,
    weeklyTier: 'none',
    gold: state.gold + reward,
    totalGoldEarned: state.totalGoldEarned + reward,
  };

  return { state: newState, reward, prevTier };
}

/** 미니게임 점수로 주간 최고 기록 갱신 */
export function updateWeeklyScore(state: PetPalState, score: number): PetPalState {
  const currentWeek = getCurrentWeekStartISO();
  // 아직 이번 주 초기화가 안 되었으면 초기화
  const weeklyStartDate = state.weeklyStartDate === currentWeek
    ? state.weeklyStartDate : currentWeek;
  const weeklyBestScore = state.weeklyStartDate === currentWeek
    ? Math.max(state.weeklyBestScore, score) : score;
  const weeklyTier = calcWeeklyTier(weeklyBestScore);

  return { ...state, weeklyBestScore, weeklyStartDate, weeklyTier };
}
