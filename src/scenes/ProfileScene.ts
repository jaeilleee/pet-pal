/**
 * ProfileScene -- 펫 프로필 + 일기 + 통계
 */

import type { Scene } from './SceneManager';
import type { AppContext } from '../app/AppContext';
import type { PetPalState } from '../data/state';
import type { SceneManager } from './SceneManager';
import { PETS, getGrowthStage, bondToNextStage } from '../data/pets';
import { overallMood, moodEmoji, generateDiaryEntry } from '../data/state';
import { COLORS } from '../data/design-tokens';

type Ctx = AppContext<PetPalState, SceneManager>;

export class ProfileScene implements Scene {
  private ctx: Ctx;
  private cleanups: Array<() => void> = [];

  constructor(ctx: Ctx) {
    this.ctx = ctx;
  }

  mount(root: HTMLElement): void {
    const state = this.ctx.state.current;
    const pet = PETS[state.petType!];
    const stage = getGrowthStage(state.petType!, state.petStats.bond);
    const stageInfo = pet.stages[stage];
    const toNext = bondToNextStage(state.petType!, state.petStats.bond);

    // 자동 일기 생성 (오늘 것이 없으면)
    const today = new Date().toISOString().slice(0, 10);
    if (!state.diaryEntries.find(d => d.date === today)) {
      state.diaryEntries.push(generateDiaryEntry(state));
      if (state.diaryEntries.length > 30) state.diaryEntries.shift();
      this.ctx.save.save(state);
    }

    root.innerHTML = `
      <div class="scene profile-scene">
        <div class="scene-header">
          <button class="btn-back" id="btn-back">←</button>
          <h2>프로필</h2>
        </div>

        <div class="profile-card">
          <div class="profile-pet">
            <span class="profile-emoji" style="font-size:${stageInfo.size}px">${stageInfo.emoji}</span>
          </div>
          <h3 class="profile-name">${state.petName}</h3>
          <p class="profile-stage">${stageInfo.name} · ${stageInfo.description}</p>
          <p class="profile-mood">${moodEmoji(state.petStats)} 기분: ${overallMood(state.petStats)}점</p>
          ${toNext > 0 ? `<p class="profile-next">다음 진화까지 유대감 ${toNext} 필요</p>` : '<p class="profile-next">최종 진화 완료! ✨</p>'}
        </div>

        <div class="profile-section">
          <h3>통계</h3>
          <div class="stats-grid">
            <div class="stat-item"><span class="stat-num">${state.totalFeeds}</span><span>먹이</span></div>
            <div class="stat-item"><span class="stat-num">${state.totalPlays}</span><span>놀기</span></div>
            <div class="stat-item"><span class="stat-num">${state.totalWalks}</span><span>산책</span></div>
            <div class="stat-item"><span class="stat-num">${state.totalBaths}</span><span>씻기</span></div>
            <div class="stat-item"><span class="stat-num">${state.totalTalks}</span><span>대화</span></div>
            <div class="stat-item"><span class="stat-num">${state.totalMiniGamesPlayed}</span><span>게임</span></div>
          </div>
          <div class="stats-extra">
            <p>💰 총 획득 골드: ${state.totalGoldEarned}G</p>
            <p>🏆 미니게임 최고: ${state.miniGameHighScore}점</p>
            <p>🔥 연속 출석: ${state.streak}일 (최고: ${state.bestStreak}일)</p>
            <p>❤️ 유대감: ${state.petStats.bond}</p>
          </div>
        </div>

        <div class="profile-section">
          <h3>📖 ${state.petName}의 일기</h3>
          <div class="diary-list">
            ${state.diaryEntries.slice(-7).reverse().map(d => `
              <div class="diary-entry">
                <span class="diary-date">${d.date}</span>
                <span class="diary-emoji">${d.emoji}</span>
                <span class="diary-text">${d.text}</span>
              </div>
            `).join('')}
            ${state.diaryEntries.length === 0 ? '<p class="empty-text">아직 일기가 없어요</p>' : ''}
          </div>
        </div>
      </div>
    `;

    const backBtn = root.querySelector('#btn-back') as HTMLElement;
    const handler = (): void => {
      this.ctx.sound.playClick();
      import('./HomeScene').then(m => {
        this.ctx.scenes.switchTo(() => new m.HomeScene(this.ctx));
      });
    };
    backBtn.addEventListener('click', handler);
    this.cleanups.push(() => backBtn.removeEventListener('click', handler));
  }

  unmount(): void {
    this.cleanups.forEach(fn => fn());
    this.cleanups = [];
  }
}
