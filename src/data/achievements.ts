/**
 * Achievements -- 27개 업적 시스템
 */

import type { PetPalState } from './state';
import { getGrowthStage } from './pets';

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  emoji: string;
  reward: number;
  check: (state: PetPalState) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // === 먹이 ===
  { id: 'feed-1', name: '첫 식사', description: '처음으로 먹이를 줬어요', emoji: '🍖', reward: 10, check: s => s.totalFeeds >= 1 },
  { id: 'feed-10', name: '요리사', description: '먹이를 10번 줬어요', emoji: '👨‍🍳', reward: 30, check: s => s.totalFeeds >= 10 },
  { id: 'feed-50', name: '셰프', description: '먹이를 50번 줬어요', emoji: '🍽️', reward: 100, check: s => s.totalFeeds >= 50 },
  { id: 'feed-100', name: '미쉐린 셰프', description: '먹이를 100번 줬어요', emoji: '⭐', reward: 300, check: s => s.totalFeeds >= 100 },

  // === 놀기 ===
  { id: 'play-1', name: '첫 놀이', description: '처음으로 놀아줬어요', emoji: '🎾', reward: 10, check: s => s.totalPlays >= 1 },
  { id: 'play-10', name: '놀이친구', description: '10번 놀아줬어요', emoji: '🎪', reward: 30, check: s => s.totalPlays >= 10 },
  { id: 'play-50', name: '놀이왕', description: '50번 놀아줬어요', emoji: '🏆', reward: 100, check: s => s.totalPlays >= 50 },

  // === 산책 ===
  { id: 'walk-1', name: '첫 산책', description: '처음으로 산책했어요', emoji: '🚶', reward: 10, check: s => s.totalWalks >= 1 },
  { id: 'walk-10', name: '산책러', description: '10번 산책했어요', emoji: '🌳', reward: 30, check: s => s.totalWalks >= 10 },
  { id: 'walk-30', name: '마라토너', description: '30번 산책했어요', emoji: '🏃', reward: 100, check: s => s.totalWalks >= 30 },

  // === 씻기 ===
  { id: 'clean-1', name: '첫 목욕', description: '처음으로 씻겼어요', emoji: '🛁', reward: 10, check: s => s.totalBaths >= 1 },
  { id: 'clean-20', name: '깨끗이', description: '20번 씻겼어요', emoji: '✨', reward: 50, check: s => s.totalBaths >= 20 },

  // === 대화 ===
  { id: 'talk-1', name: '첫 대화', description: '처음으로 대화했어요', emoji: '💬', reward: 10, check: s => s.totalTalks >= 1 },
  { id: 'talk-20', name: '수다쟁이', description: '20번 대화했어요', emoji: '🗣️', reward: 50, check: s => s.totalTalks >= 20 },
  { id: 'talk-50', name: '베스트프렌드', description: '50번 대화했어요', emoji: '💕', reward: 150, check: s => s.totalTalks >= 50 },

  // === 성장 ===
  { id: 'grow-child', name: '성장기', description: '꼬마로 성장했어요', emoji: '🌱', reward: 50, check: s => s.petType != null && ['child','teen','adult'].includes(getGrowthStage(s.petType, s.petStats.bond)) },
  { id: 'grow-teen', name: '청소년기', description: '청소년으로 성장했어요', emoji: '🌿', reward: 100, check: s => s.petType != null && ['teen','adult'].includes(getGrowthStage(s.petType, s.petStats.bond)) },
  { id: 'grow-adult', name: '완전체', description: '어른으로 성장했어요', emoji: '🌳', reward: 300, check: s => s.petType != null && getGrowthStage(s.petType, s.petStats.bond) === 'adult' },

  // === 경제 ===
  { id: 'gold-500', name: '저축의 시작', description: '골드를 500 모았어요', emoji: '💰', reward: 20, check: s => s.totalGoldEarned >= 500 },
  { id: 'gold-2000', name: '부자', description: '골드를 2000 모았어요', emoji: '💎', reward: 80, check: s => s.totalGoldEarned >= 2000 },
  { id: 'gold-5000', name: '재벌', description: '골드를 5000 모았어요', emoji: '🏦', reward: 200, check: s => s.totalGoldEarned >= 5000 },

  // === 출석 ===
  { id: 'streak-3', name: '3일 연속', description: '3일 연속 출석!', emoji: '🔥', reward: 30, check: s => s.bestStreak >= 3 },
  { id: 'streak-7', name: '1주일 연속', description: '7일 연속 출석!', emoji: '🔥', reward: 100, check: s => s.bestStreak >= 7 },
  { id: 'streak-30', name: '한 달 연속', description: '30일 연속 출석!', emoji: '🔥', reward: 500, check: s => s.bestStreak >= 30 },

  // === 미니게임 ===
  { id: 'game-1', name: '게이머', description: '미니게임 1판 플레이', emoji: '🎮', reward: 10, check: s => s.totalMiniGamesPlayed >= 1 },
  { id: 'game-10', name: '프로게이머', description: '미니게임 10판 플레이', emoji: '🕹️', reward: 50, check: s => s.totalMiniGamesPlayed >= 10 },
  { id: 'highscore-100', name: '고득점', description: '미니게임 100점 달성', emoji: '🏅', reward: 80, check: s => s.miniGameHighScore >= 100 },

  // === 유대감 ===
  { id: 'bond-100', name: '친한 사이', description: '유대감 100 달성', emoji: '❤️', reward: 50, check: s => s.petStats.bond >= 100 },
];

/** 새로 달성된 업적 확인 */
export function checkNewAchievements(state: PetPalState): AchievementDef[] {
  const newOnes: AchievementDef[] = [];
  for (const ach of ACHIEVEMENTS) {
    if (state.achievements[ach.id]) continue;
    if (ach.check(state)) {
      newOnes.push(ach);
    }
  }
  return newOnes;
}

/** 업적 달성 처리 (state 직접 변경) */
export function claimAchievements(state: PetPalState, achievements: AchievementDef[]): number {
  let totalReward = 0;
  for (const ach of achievements) {
    state.achievements[ach.id] = true;
    state.gold += ach.reward;
    state.totalGoldEarned += ach.reward;
    totalReward += ach.reward;
  }
  return totalReward;
}
