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

const CARD_EMOJIS = ['\u{1F436}', '\u{1F431}', '\u{1F426}', '\u{1F437}', '\u{1F98E}', '\u{1F430}'];

/** Time limit in seconds */
const TIME_LIMIT = 120;

interface Card {
  id: number;
  emoji: string;
  flipped: boolean;
  matched: boolean;
  /** Flip animation progress 0..1 (0=back, 1=front) */
  flipProgress: number;
  /** Target flip state */
  flipTarget: number;
  /** Match sparkle timer */
  matchSparkle: number;
  /** Scale for match bounce */
  matchScale: number;
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
  private animFrameId = 0;
  private root: HTMLElement | null = null;

  constructor(ctx: Ctx) {
    this.ctx = ctx;
  }

  mount(root: HTMLElement): void {
    this.root = root;
    this.initCards();
    this.startTime = Date.now();

    root.innerHTML = `
      <div class="scene memory-scene">
        <div class="mg-header">
          <button class="btn-back" id="btn-back">\u2190</button>
          <div class="mg-score">\uB9DE\uCD98 \uC218: <span id="mem-matches">0</span>/6</div>
          <div class="mg-lives" id="mem-time">\u23F1\uFE0F 0\uCD08</div>
        </div>
        <div class="memory-timer-bar-wrap" id="mem-timer-wrap">
          <div class="memory-timer-bar" id="mem-timer-bar"></div>
        </div>
        <div class="memory-grid" id="memory-grid"></div>
        <div class="mg-overlay" id="mem-overlay" style="display:none">
          <div class="mg-result">
            <h3 id="mem-result-title">\uC644\uB8CC!</h3>
            <p>\uC2DC\uAC04: <span id="mem-final-time">0</span>\uCD08</p>
            <p>\uC2DC\uB3C4: <span id="mem-final-attempts">0</span>\uD68C</p>
            <p id="mem-reward-text"></p>
            <button class="btn-primary" id="btn-mem-retry">\uB2E4\uC2DC\uD558\uAE30</button>
            <button class="btn-secondary" id="btn-mem-home">\uD648\uC73C\uB85C</button>
          </div>
        </div>
      </div>
    `;

    this.renderGrid(root);
    this.bindEvents(root);
    this.startTimer(root);
    this.startAnimLoop();
  }

  private initCards(): void {
    const pairs: Card[] = [];
    let id = 0;
    for (const emoji of CARD_EMOJIS) {
      pairs.push({ id: id++, emoji, flipped: false, matched: false, flipProgress: 0, flipTarget: 0, matchSparkle: 0, matchScale: 1 });
      pairs.push({ id: id++, emoji, flipped: false, matched: false, flipProgress: 0, flipTarget: 0, matchSparkle: 0, matchScale: 1 });
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

    grid.innerHTML = this.cards.map(card => {
      const scaleX = this.getFlipScaleX(card.flipProgress, card.flipped || card.matched);
      const showFront = card.flipProgress > 0.5 || card.matched;
      const matchedClass = card.matched ? 'matched' : '';
      const flippedClass = (card.flipped || card.matched) ? 'flipped' : '';

      return `
      <button class="memory-card ${flippedClass} ${matchedClass}"
              data-card-id="${card.id}" ${card.matched ? 'disabled' : ''}
              style="transform: scaleX(${scaleX.toFixed(3)}) scale(${card.matchScale.toFixed(3)});">
        <span class="card-back" style="display:${showFront ? 'none' : 'block'}">\u2753</span>
        <span class="card-front" style="display:${showFront ? 'block' : 'none'}">${card.emoji}</span>
        ${card.matchSparkle > 0 ? '<span class="card-sparkle">\u2728</span>' : ''}
      </button>`;
    }).join('');
  }

  private getFlipScaleX(progress: number, isFlipped: boolean): number {
    // Progress 0..1 represents the animation
    // At 0.5, scaleX = 0 (card edge-on), then opens to the other side
    if (!isFlipped && progress <= 0) return 1;
    if (isFlipped && progress >= 1) return 1;

    // During animation: 0->0.5 shrink, 0.5->1 expand
    if (progress <= 0.5) {
      return 1 - progress * 2; // 1 -> 0
    }
    return (progress - 0.5) * 2; // 0 -> 1
  }

  private startAnimLoop(): void {
    const tick = (): void => {
      let needsUpdate = false;
      const dt = 1 / 60; // ~16ms per frame

      for (const card of this.cards) {
        // Flip animation
        if (card.flipped || card.matched) {
          if (card.flipProgress < 1) {
            card.flipProgress = Math.min(1, card.flipProgress + dt / 0.3); // 0.3s duration
            needsUpdate = true;
          }
        } else {
          if (card.flipProgress > 0) {
            card.flipProgress = Math.max(0, card.flipProgress - dt / 0.3);
            needsUpdate = true;
          }
        }

        // Match sparkle decay
        if (card.matchSparkle > 0) {
          card.matchSparkle = Math.max(0, card.matchSparkle - dt);
          needsUpdate = true;
        }

        // Match scale bounce back
        if (card.matchScale > 1) {
          card.matchScale = Math.max(1, card.matchScale - dt * 2);
          needsUpdate = true;
        }
      }

      if (needsUpdate && this.root) {
        this.renderGrid(this.root);
      }

      this.animFrameId = requestAnimationFrame(tick);
    };
    this.animFrameId = requestAnimationFrame(tick);
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
    card.flipProgress = 0; // Start animation from back
    this.ctx.sound.playClick();

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
      this.firstCard.matchSparkle = 0.8;
      this.secondCard.matchSparkle = 0.8;
      this.firstCard.matchScale = 1.2;
      this.secondCard.matchScale = 1.2;
      this.matchCount++;
      this.ctx.sound.playCoin();
      this.updateMatchDisplay(root);

      this.firstCard = null;
      this.secondCard = null;
      this.lockBoard = false;

      if (this.matchCount >= 6) {
        // Delay slightly so last match animation plays
        setTimeout(() => this.endGame(root), 400);
      }
    } else {
      // No match -- flip back after delay
      setTimeout(() => {
        if (this.firstCard) this.firstCard.flipped = false;
        if (this.secondCard) this.secondCard.flipped = false;
        this.firstCard = null;
        this.secondCard = null;
        this.lockBoard = false;
      }, 600);
      this.ctx.sound.playError();
    }
  }

  private updateMatchDisplay(root: HTMLElement): void {
    const el = root.querySelector('#mem-matches');
    if (el) el.textContent = String(this.matchCount);
  }

  private startTimer(root: HTMLElement): void {
    const interval = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      const remaining = Math.max(0, TIME_LIMIT - elapsed);

      // Timer text
      const el = root.querySelector('#mem-time');
      if (el) el.textContent = `\u23F1\uFE0F ${elapsed}\uCD08`;

      // Timer bar
      const bar = root.querySelector('#mem-timer-bar') as HTMLElement;
      if (bar) {
        const pct = (remaining / TIME_LIMIT) * 100;
        bar.style.width = `${pct}%`;

        // Color changes: green -> yellow -> red
        if (pct > 50) {
          bar.style.background = '#66BB6A';
        } else if (pct > 25) {
          bar.style.background = '#FFA726';
        } else {
          bar.style.background = '#EF5350';
        }
      }

      // Time's up
      if (remaining <= 0 && this.matchCount < 6) {
        this.endGame(root);
      }
    }, 200);
    this.cleanups.push(() => clearInterval(interval));
  }

  private endGame(root: HTMLElement): void {
    const elapsedSec = Math.floor((Date.now() - this.startTime) / 1000);

    // Score: faster = higher score (max 300, min 30)
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
    if (rewardText) rewardText.textContent = `\uBCF4\uC0C1: +${goldReward}G ${isHighScore ? '\u{1F3C6} \uCD5C\uACE0\uAE30\uB85D!' : ''}`;
    if (title) {
      if (this.matchCount < 6) {
        title.textContent = '\uC2DC\uAC04 \uCD08\uACFC!';
      } else if (elapsedSec < 30) {
        title.textContent = '\uBC88\uAC1C \uD074\uB9AC\uC5B4!';
      } else if (isHighScore) {
        title.textContent = '\uCD5C\uACE0\uAE30\uB85D!';
      } else {
        title.textContent = '\uC644\uB8CC!';
      }
    }

    this.ctx.sound.playLevelUp();
  }

  private goHome(): void {
    this.ctx.sound.playClick();
    import('./HomeScene').then(m => {
      this.ctx.scenes.switchTo(() => new m.HomeScene(this.ctx));
    }).catch(err => console.error('[MemoryGameScene] HomeScene load failed', err));
  }

  unmount(): void {
    cancelAnimationFrame(this.animFrameId);
    this.cleanups.forEach(fn => fn());
    this.cleanups = [];
    this.root = null;
  }
}
