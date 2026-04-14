/**
 * ProfileScene -- 펫 프로필 + 일기 + 통계
 */

import type { Scene } from './SceneManager';
import type { AppContext } from '../app/AppContext';
import type { PetPalState } from '../data/state';
import type { SceneManager } from './SceneManager';
import { PETS, getGrowthStage, bondToNextStage } from '../data/pets';
import { getActivePet, overallMood, moodEmoji, generateDiaryEntry } from '../data/state';
import { COLORS } from '../data/design-tokens';
import { drawPet, createAnimState } from '../game/PetRenderer';

type Ctx = AppContext<PetPalState, SceneManager>;

export class ProfileScene implements Scene {
  private ctx: Ctx;
  private cleanups: Array<() => void> = [];

  constructor(ctx: Ctx) {
    this.ctx = ctx;
  }

  mount(root: HTMLElement): void {
    const state = this.ctx.state.current;
    const activePet = getActivePet(state);
    if (!activePet) return;

    const petDef = PETS[activePet.type];
    const stage = getGrowthStage(activePet.type, activePet.stats.bond);
    const stageInfo = petDef.stages[stage];
    const toNext = bondToNextStage(activePet.type, activePet.stats.bond);

    this.maybeGenerateDiary(state, activePet);

    root.innerHTML = `
      <div class="scene profile-scene">
        <div class="scene-header">
          <button class="btn-back" id="btn-back">←</button>
          <h2>프로필</h2>
        </div>

        <div class="profile-card">
          <div class="profile-pet" id="profile-pet-canvas"></div>
          <h3 class="profile-name">${activePet.name}</h3>
          <p class="profile-stage">${stageInfo.name} - ${stageInfo.description}</p>
          <p class="profile-mood">${moodEmoji(activePet.stats)} 기분: ${overallMood(activePet.stats)}점</p>
          ${toNext > 0 ? `<p class="profile-next">다음 진화까지 유대감 ${toNext} 필요</p>` : '<p class="profile-next">최종 진화 완료!</p>'}
        </div>

        <div class="profile-section">
          <h3>통계</h3>
          ${this.renderStats(state)}
        </div>

        <div class="profile-section">
          <h3>${activePet.name}의 일기</h3>
          ${this.renderDiary(state)}
        </div>

        <div class="profile-section profile-actions">
          <button class="btn-profile-action" id="btn-visitor-book">📖 방문자 도감</button>
        </div>
      </div>
    `;

    this.drawProfilePet(root, activePet.type, stage, stageInfo.size);
    this.bindBack(root);
    this.bindVisitorBook(root);
  }

  private maybeGenerateDiary(state: PetPalState, pet: import('../data/state').PetData): void {
    const today = new Date().toISOString().slice(0, 10);
    if (!state.diaryEntries.find(d => d.date === today)) {
      state.diaryEntries.push(generateDiaryEntry(pet));
      if (state.diaryEntries.length > 30) state.diaryEntries.shift();
      this.ctx.save.save(state);
    }
  }

  private renderStats(state: PetPalState): string {
    const activePet = getActivePet(state);
    return `
      <div class="stats-grid">
        <div class="stat-item"><span class="stat-num">${state.totalFeeds}</span><span>먹이</span></div>
        <div class="stat-item"><span class="stat-num">${state.totalPlays}</span><span>놀기</span></div>
        <div class="stat-item"><span class="stat-num">${state.totalWalks}</span><span>산책</span></div>
        <div class="stat-item"><span class="stat-num">${state.totalBaths}</span><span>씻기</span></div>
        <div class="stat-item"><span class="stat-num">${state.totalTalks}</span><span>대화</span></div>
        <div class="stat-item"><span class="stat-num">${state.totalMiniGamesPlayed}</span><span>게임</span></div>
      </div>
      <div class="stats-extra">
        <p>총 획득 골드: ${state.totalGoldEarned}G</p>
        <p>미니게임 최고: ${state.miniGameHighScore}점</p>
        <p>연속 출석: ${state.streak}일 (최고: ${state.bestStreak}일)</p>
        <p>유대감: ${activePet?.stats.bond ?? 0}</p>
      </div>
    `;
  }

  private renderDiary(state: PetPalState): string {
    if (state.diaryEntries.length === 0) {
      return '<p class="empty-text">아직 일기가 없어요</p>';
    }
    return `<div class="diary-list">
      ${state.diaryEntries.slice(-7).reverse().map(d => `
        <div class="diary-entry">
          <span class="diary-date">${d.date}</span>
          <span class="diary-emoji">${d.emoji}</span>
          <span class="diary-text">${d.text}</span>
          ${d.petName ? `<span class="diary-pet">${d.petName}</span>` : ''}
        </div>
      `).join('')}
    </div>`;
  }

  private drawProfilePet(
    root: HTMLElement,
    petType: import('../data/pets').PetType,
    stage: import('../data/pets').GrowthStage,
    size: number,
  ): void {
    const container = root.querySelector('#profile-pet-canvas') as HTMLElement;
    if (!container) return;

    const cvs = document.createElement('canvas');
    const cSize = 120;
    cvs.width = cSize * 2; cvs.height = cSize * 2;
    cvs.style.width = `${cSize}px`; cvs.style.height = `${cSize}px`;
    cvs.style.display = 'block'; cvs.style.margin = '0 auto 8px';
    container.appendChild(cvs);
    const pctx = cvs.getContext('2d');
    if (pctx) {
      pctx.scale(2, 2);
      const anim = createAnimState();
      anim.emotion = 'happy';
      drawPet(pctx, petType, stage, anim, cSize / 2, cSize / 2 + 5, size * 0.8);
    }
  }

  private bindVisitorBook(root: HTMLElement): void {
    const btn = root.querySelector('#btn-visitor-book');
    if (!btn) return;
    const handler = (): void => {
      this.ctx.sound.playClick();
      import('./VisitorBookScene').then(m => {
        this.ctx.scenes.switchTo(() => new m.VisitorBookScene(this.ctx));
      }).catch(err => console.error('[ProfileScene] VisitorBook load failed', err));
    };
    btn.addEventListener('click', handler);
    this.cleanups.push(() => btn.removeEventListener('click', handler));
  }

  private bindBack(root: HTMLElement): void {
    const backBtn = root.querySelector('#btn-back') as HTMLElement;
    const handler = (): void => {
      this.ctx.sound.playClick();
      import('./HomeScene').then(m => {
        this.ctx.scenes.switchTo(() => new m.HomeScene(this.ctx));
      }).catch(err => console.error('[ProfileScene] load failed', err));
    };
    backBtn.addEventListener('click', handler);
    this.cleanups.push(() => backBtn.removeEventListener('click', handler));
  }

  unmount(): void {
    this.cleanups.forEach(fn => fn());
    this.cleanups = [];
  }
}
