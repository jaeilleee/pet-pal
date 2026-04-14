/**
 * MemoryGameScene -- 기억력 카드 뒤집기 미니게임
 * 4x3 그리드 (12장 = 6쌍), 같은 펫 이모지 맞추기
 */

import type { Scene } from './SceneManager';
import type { AppContext } from '../app/AppContext';
import type { PetPalState } from '../data/state';
import type { SceneManager } from './SceneManager';
import { applyEffectsToPet } from '../data/state';
import { updateWeeklyScore } from '../data/daily';
import { showToast } from '../ui/Toast';

type Ctx = AppContext<PetPalState, SceneManager>;

const CARD_EMOJIS = ['🐶', '🐱', '🐦', '🐷', '🦎', '🐰'];

interface Card {
  id: number;
  emoji: string;
  flipped: boolean;
  matched: boolean;
}

export class MemoryGameScene implements Scene {
  private ctx: Ctx;
  private cleanups: Array<() => void> = [];
  private cards: Card[] = [];
  private firstCard: Card | null = null;
  private secondCard: Card | null = null;
  private lockBoard = false;
  private startTime = 0;
  private matchCount = 0;
  private attempts = 0;

  constructor(ctx: Ctx) {
    this.ctx = ctx;
  }

  mount(root: HTMLElement): void {
    this.initCards();
    this.startTime = Date.now();

    root.innerHTML = `
      <div class="scene memory-scene">
        <div class="mg-header">
          <button class="btn-back" id="btn-back">←</button>
          <div class="mg-score">맞춘 수: <span id="mem-matches">0</span>/6</div>
          <div class="mg-lives" id="mem-time">⏱️ 0초</div>
        </div>
        <div class="memory-grid" id="memory-grid"></div>
        <div class="mg-overlay" id="mem-overlay" style="display:none">
          <div class="mg-result">
            <h3 id="mem-result-title">완료!</h3>
            <p>시간: <span id="mem-final-time">0</span>초</p>
            <p>시도: <span id="mem-final-attempts">0</span>회</p>
            <p id="mem-reward-text"></p>
            <button class="btn-primary" id="btn-mem-retry">다시하기</button>
            <button class="btn-secondary" id="btn-mem-home">홈으로</button>
          </div>
        </div>
      </div>
    `;

    this.renderGrid(root);
    this.bindEvents(root);
    this.startTimer(root);
  }

  private initCards(): void {
    const pairs: Card[] = [];
    let id = 0;
    for (const emoji of CARD_EMOJIS) {
      pairs.push({ id: id++, emoji, flipped: false, matched: false });
      pairs.push({ id: id++, emoji, flipped: false, matched: false });
    }
    // Fisher-Yates shuffle
    for (let i = pairs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
    }
    this.cards = pairs;
    this.matchCount = 0;
    this.attempts = 0;
    this.firstCard = null;
    this.secondCard = null;
    this.lockBoard = false;
  }

  private renderGrid(root: HTMLElement): void {
    const grid = root.querySelector('#memory-grid') as HTMLElement;
    if (!grid) return;

    grid.innerHTML = this.cards.map(card => `
      <button class="memory-card ${card.flipped || card.matched ? 'flipped' : ''} ${card.matched ? 'matched' : ''}"
              data-card-id="${card.id}" ${card.matched ? 'disabled' : ''}>
        <span class="card-back">❓</span>
        <span class="card-front">${card.emoji}</span>
      </button>
    `).join('');
  }

  private bindEvents(root: HTMLElement): void {
    const grid = root.querySelector('#memory-grid') as HTMLElement;
    const gridHandler = (e: Event): void => {
      const btn = (e.target as HTMLElement).closest('.memory-card') as HTMLElement | null;
      if (!btn || this.lockBoard) return;

      const cardId = parseInt(btn.dataset.cardId ?? '-1', 10);
      const card = this.cards.find(c => c.id === cardId);
      if (!card || card.flipped || card.matched) return;

      this.flipCard(card, root);
    };
    grid.addEventListener('click', gridHandler);
    this.cleanups.push(() => grid.removeEventListener('click', gridHandler));

    const backBtn = root.querySelector('#btn-back') as HTMLElement;
    const backHandler = (): void => this.goHome();
    backBtn.addEventListener('click', backHandler);
    this.cleanups.push(() => backBtn.removeEventListener('click', backHandler));

    const retryBtn = root.querySelector('#btn-mem-retry') as HTMLElement;
    const retryHandler = (): void => {
      (root.querySelector('#mem-overlay') as HTMLElement).style.display = 'none';
      this.initCards();
      this.startTime = Date.now();
      this.renderGrid(root);
    };
    retryBtn.addEventListener('click', retryHandler);
    this.cleanups.push(() => retryBtn.removeEventListener('click', retryHandler));

    const homeBtn = root.querySelector('#btn-mem-home') as HTMLElement;
    const homeHandler = (): void => this.goHome();
    homeBtn.addEventListener('click', homeHandler);
    this.cleanups.push(() => homeBtn.removeEventListener('click', homeHandler));
  }

  private flipCard(card: Card, root: HTMLElement): void {
    card.flipped = true;
    this.ctx.sound.playClick();
    this.renderGrid(root);

    if (!this.firstCard) {
      this.firstCard = card;
      return;
    }

    this.secondCard = card;
    this.attempts++;
    this.lockBoard = true;

    if (this.firstCard.emoji === this.secondCard.emoji) {
      // Match!
      this.firstCard.matched = true;
      this.secondCard.matched = true;
      this.matchCount++;
      this.ctx.sound.playCoin();
      this.renderGrid(root);
      this.updateMatchDisplay(root);

      this.firstCard = null;
      this.secondCard = null;
      this.lockBoard = false;

      if (this.matchCount >= 6) {
        this.endGame(root);
      }
    } else {
      // No match -- flip back after delay
      setTimeout(() => {
        if (this.firstCard) this.firstCard.flipped = false;
        if (this.secondCard) this.secondCard.flipped = false;
        this.firstCard = null;
        this.secondCard = null;
        this.lockBoard = false;
        this.renderGrid(root);
      }, 500);
      this.ctx.sound.playError();
    }
  }

  private updateMatchDisplay(root: HTMLElement): void {
    const el = root.querySelector('#mem-matches');
    if (el) el.textContent = String(this.matchCount);
  }

  private startTimer(root: HTMLElement): void {
    const interval = window.setInterval(() => {
      const el = root.querySelector('#mem-time');
      if (el) {
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        el.textContent = `⏱️ ${elapsed}초`;
      }
    }, 1000);
    this.cleanups.push(() => clearInterval(interval));
  }

  private endGame(root: HTMLElement): void {
    const elapsedSec = Math.floor((Date.now() - this.startTime) / 1000);

    // 점수: 빠를수록 높은 점수 (최대 300, 최소 30)
    const timeBonus = Math.max(0, 120 - elapsedSec);
    const attemptPenalty = Math.max(0, (this.attempts - 6) * 5);
    const score = Math.max(30, 100 + timeBonus * 2 - attemptPenalty);

    let state = this.ctx.state.current;
    state = { ...state, totalMiniGamesPlayed: state.totalMiniGamesPlayed + 1 };
    const isHighScore = score > state.miniGameHighScore;
    if (isHighScore) state = { ...state, miniGameHighScore: score };

    const goldReward = Math.floor(score / 3);
    state = {
      ...state,
      gold: state.gold + goldReward,
      totalGoldEarned: state.totalGoldEarned + goldReward,
    };
    state = applyEffectsToPet(state, state.activePetIndex, { happiness: 10, bond: 3 });
    state = updateWeeklyScore(state, score);
    this.ctx.state.current = state;
    this.ctx.save.save(state);

    const overlay = root.querySelector('#mem-overlay') as HTMLElement;
    const finalTime = root.querySelector('#mem-final-time') as HTMLElement;
    const finalAttempts = root.querySelector('#mem-final-attempts') as HTMLElement;
    const rewardText = root.querySelector('#mem-reward-text') as HTMLElement;
    const title = root.querySelector('#mem-result-title') as HTMLElement;

    if (overlay) overlay.style.display = 'flex';
    if (finalTime) finalTime.textContent = String(elapsedSec);
    if (finalAttempts) finalAttempts.textContent = String(this.attempts);
    if (rewardText) rewardText.textContent = `보상: +${goldReward}G ${isHighScore ? '🏆 최고기록!' : ''}`;
    if (title) title.textContent = elapsedSec < 30 ? '번개 클리어!' : isHighScore ? '최고기록!' : '완료!';

    this.ctx.sound.playLevelUp();
  }

  private goHome(): void {
    this.ctx.sound.playClick();
    import('./HomeScene').then(m => {
      this.ctx.scenes.switchTo(() => new m.HomeScene(this.ctx));
    }).catch(err => console.error('[MemoryGameScene] HomeScene load failed', err));
  }

  unmount(): void {
    this.cleanups.forEach(fn => fn());
    this.cleanups = [];
  }
}
