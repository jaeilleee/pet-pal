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
