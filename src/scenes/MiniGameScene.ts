/**
 * MiniGameScene -- 먹이 캐치 미니게임 (Canvas)
 * 하늘에서 떨어지는 먹이를 좌우 이동으로 받기
 */

import type { Scene } from './SceneManager';
import type { AppContext } from '../app/AppContext';
import type { PetPalState } from '../data/state';
import type { SceneManager } from './SceneManager';
import { COLORS } from '../data/design-tokens';
import { applyEffectsToPet } from '../data/state';
import { updateWeeklyScore } from '../data/daily';
import { showToast } from '../ui/Toast';

type Ctx = AppContext<PetPalState, SceneManager>;

interface FallingItem {
  x: number;
  y: number;
  emoji: string;
  speed: number;
  points: number;
  isBad: boolean;
}

const GOOD_ITEMS = ['🍖', '🍪', '🎾', '🦴', '🍎', '🥕', '🧀'];
const BAD_ITEMS = ['💩', '🪨', '🌶️'];

export class MiniGameScene implements Scene {
  private ctx: Ctx;
  private cleanups: Array<() => void> = [];
  private canvas: HTMLCanvasElement | null = null;
  private gameCtx: CanvasRenderingContext2D | null = null;
  private running = false;
  private score = 0;
  private lives = 3;
  private currentStage = 0;
  private lastStageScore = 0;
  private stageFlashTimer = 0;
  private playerX = 0;
  private items: FallingItem[] = [];
  private frameId = 0;
  private spawnTimer = 0;
  private elapsed = 0;
  private W = 0;
  private H = 0;

  constructor(ctx: Ctx) {
    this.ctx = ctx;
  }

  mount(root: HTMLElement): void {
    root.innerHTML = `
      <div class="scene minigame-scene">
        <div class="mg-header">
          <button class="btn-back" id="btn-back">←</button>
          <div class="mg-score">점수: <span id="mg-score">0</span></div>
          <div class="mg-lives" id="mg-lives">❤️❤️❤️</div>
        </div>
        <canvas id="mg-canvas"></canvas>
        <div class="mg-overlay" id="mg-overlay" style="display:none">
          <div class="mg-result">
            <h3 id="mg-result-title">게임 오버</h3>
            <p>점수: <span id="mg-final-score">0</span></p>
            <p id="mg-reward-text"></p>
            <button class="btn-primary" id="btn-retry">다시하기</button>
            <button class="btn-secondary" id="btn-back-home">홈으로</button>
          </div>
        </div>
      </div>
    `;

    this.canvas = root.querySelector('#mg-canvas') as HTMLCanvasElement;
    this.W = Math.min(window.innerWidth, 390);
    this.H = Math.min(window.innerHeight - 60, 600);
    this.canvas.width = this.W * 2;
    this.canvas.height = this.H * 2;
    this.canvas.style.width = `${this.W}px`;
    this.canvas.style.height = `${this.H}px`;
    this.gameCtx = this.canvas.getContext('2d');
    if (this.gameCtx) this.gameCtx.scale(2, 2);

    this.playerX = this.W / 2;
    this.startGame();

    // touch/mouse control
    const moveHandler = (e: TouchEvent | MouseEvent): void => {
      e.preventDefault();
      const rect = this.canvas!.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      this.playerX = Math.max(25, Math.min(this.W - 25, clientX - rect.left));
    };
    this.canvas.addEventListener('touchmove', moveHandler, { passive: false });
    this.canvas.addEventListener('mousemove', moveHandler);
    this.cleanups.push(() => {
      this.canvas?.removeEventListener('touchmove', moveHandler);
      this.canvas?.removeEventListener('mousemove', moveHandler);
    });

    // back button
    const backBtn = root.querySelector('#btn-back') as HTMLElement;
    const backHandler = (): void => this.goHome();
    backBtn.addEventListener('click', backHandler);
    this.cleanups.push(() => backBtn.removeEventListener('click', backHandler));

    // retry & home
    const retryBtn = root.querySelector('#btn-retry') as HTMLElement;
    const homeBtn = root.querySelector('#btn-back-home') as HTMLElement;
    retryBtn.addEventListener('click', () => {
      (root.querySelector('#mg-overlay') as HTMLElement).style.display = 'none';
      this.startGame();
    });
    homeBtn.addEventListener('click', () => this.goHome());
  }

  private startGame(): void {
    this.score = 0;
    this.lives = 3;
    this.currentStage = 0;
    this.lastStageScore = 0;
    this.stageFlashTimer = 0;
    this.items = [];
    this.spawnTimer = 0;
    this.elapsed = 0;
    this.running = true;
    this.updateUI();
    this.lastTime = performance.now();
    this.frameId = requestAnimationFrame(this.loop);
  }

  private lastTime = 0;
  private loop = (time: number): void => {
    if (!this.running) return;
    const dt = Math.min((time - this.lastTime) / 1000, 0.05);
    this.lastTime = time;
    this.elapsed += dt;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnItem();
      this.spawnTimer = Math.max(0.4, 1.2 - this.elapsed * 0.01);
    }

    if (this.stageFlashTimer > 0) this.stageFlashTimer -= dt;

    this.updateItems(dt);
    this.render();
    this.frameId = requestAnimationFrame(this.loop);
  };

  private spawnItem(): void {
    const isBad = Math.random() < 0.2;
    const pool = isBad ? BAD_ITEMS : GOOD_ITEMS;
    this.items.push({
      x: 30 + Math.random() * (this.W - 60),
      y: -20,
      emoji: pool[Math.floor(Math.random() * pool.length)],
      speed: 120 + Math.random() * 80 + this.elapsed * 2,
      points: isBad ? -1 : (10 + Math.floor(Math.random() * 10)),
      isBad,
    });
  }

  private updateItems(dt: number): void {
    const catchY = this.H - 60;
    const catchRadius = 35;

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.y += item.speed * dt;

      // catch check
      if (item.y >= catchY - 10 && item.y <= catchY + 20) {
        if (Math.abs(item.x - this.playerX) < catchRadius) {
          if (item.isBad) {
            this.lives--;
            this.ctx.sound.playError();
          } else {
            this.score += item.points;
            this.ctx.sound.playCoin();
            // 스테이지 체크 (50점마다)
            const newStage = Math.floor(this.score / 50);
            if (newStage > this.currentStage) {
              this.currentStage = newStage;
              this.stageFlashTimer = 2.0; // 2초간 표시
              const isBonusStage = this.currentStage % 5 === 0;
              showToast(`Stage ${this.currentStage} Clear! ${isBonusStage ? '🌟 보너스 x2!' : '🎉'}`);
              this.ctx.sound.playLevelUp();
            }
          }
          this.items.splice(i, 1);
          this.updateUI();
          if (this.lives <= 0) this.endGame();
          continue;
        }
      }

      // missed good item
      if (item.y > this.H + 20) {
        if (!item.isBad) {
          // no penalty for missing good items
        }
        this.items.splice(i, 1);
      }
    }
  }

  private render(): void {
    const c = this.gameCtx;
    if (!c) return;

    // bg gradient
    const grad = c.createLinearGradient(0, 0, 0, this.H);
    grad.addColorStop(0, '#E8F4FD');
    grad.addColorStop(1, '#FFF5E6');
    c.fillStyle = grad;
    c.fillRect(0, 0, this.W, this.H);

    // items
    c.font = '28px Apple Color Emoji, Segoe UI Emoji';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (const item of this.items) {
      c.fillText(item.emoji, item.x, item.y);
    }

    // player (bowl)
    c.font = '40px Apple Color Emoji, Segoe UI Emoji';
    c.fillText('🥣', this.playerX, this.H - 50);

    // ground
    c.fillStyle = '#A5D6A7';
    c.fillRect(0, this.H - 20, this.W, 20);

    // 스테이지 표시 (좌상단)
    if (this.currentStage > 0) {
      c.font = 'bold 14px Quicksand, sans-serif';
      c.textAlign = 'left';
      c.fillStyle = '#FF7043';
      c.fillText(`Stage ${this.currentStage}`, 10, 30);
    }

    // 스테이지 클리어 플래시
    if (this.stageFlashTimer > 0) {
      const alpha = Math.min(1, this.stageFlashTimer);
      c.save();
      c.globalAlpha = alpha;
      c.font = 'bold 32px Nunito, sans-serif';
      c.textAlign = 'center';
      c.fillStyle = '#FFD600';
      c.strokeStyle = '#E64A19';
      c.lineWidth = 3;
      const text = this.currentStage % 5 === 0
        ? `Stage ${this.currentStage} 🌟 x2!`
        : `Stage ${this.currentStage} Clear!`;
      c.strokeText(text, this.W / 2, this.H / 3);
      c.fillText(text, this.W / 2, this.H / 3);
      c.restore();
    }
  }

  private updateUI(): void {
    const scoreEl = document.querySelector('#mg-score');
    if (scoreEl) scoreEl.textContent = String(this.score);

    const livesEl = document.querySelector('#mg-lives');
    if (livesEl) livesEl.textContent = '❤️'.repeat(Math.max(0, this.lives));
  }

  private endGame(): void {
    this.running = false;
    cancelAnimationFrame(this.frameId);

    let state = this.ctx.state.current;
    state.totalMiniGamesPlayed++;
    const isHighScore = this.score > state.miniGameHighScore;
    if (isHighScore) state.miniGameHighScore = this.score;

    // 스테이지 보너스: 5스테이지마다 x2
    const bonusStages = Math.floor(this.currentStage / 5);
    const stageBonus = bonusStages * 2; // 보너스 배율분 추가
    let goldReward = Math.floor(this.score / 3);
    if (bonusStages > 0) goldReward = Math.floor(goldReward * (1 + bonusStages * 0.5));

    state.gold += goldReward;
    state.totalGoldEarned += goldReward;
    state = applyEffectsToPet(state, state.activePetIndex, { happiness: 10, bond: 2 });
    // 주간 토너먼트 점수 갱신
    state = updateWeeklyScore(state, this.score);
    // 최고 스테이지 기록
    if (this.currentStage > state.miniGameMaxStage) {
      state.miniGameMaxStage = this.currentStage;
    }
    this.ctx.state.current = state;
    this.ctx.save.save(state);

    const overlay = document.querySelector('#mg-overlay') as HTMLElement;
    const finalScore = document.querySelector('#mg-final-score') as HTMLElement;
    const rewardText = document.querySelector('#mg-reward-text') as HTMLElement;
    const title = document.querySelector('#mg-result-title') as HTMLElement;

    if (overlay) overlay.style.display = 'flex';
    if (finalScore) finalScore.textContent = String(this.score);
    const stageLabel = this.currentStage > 0 ? ` | 스테이지 ${this.currentStage} 달성!` : '';
    if (rewardText) rewardText.textContent = `보상: +${goldReward}G${stageLabel} ${isHighScore ? '🏆 최고기록!' : ''}`;
    if (title) title.textContent = isHighScore ? '최고기록!' : '게임 오버';

    this.ctx.sound.playLevelUp();
  }

  private goHome(): void {
    this.running = false;
    cancelAnimationFrame(this.frameId);
    this.ctx.sound.playClick();
    import('./HomeScene').then(m => {
      this.ctx.scenes.switchTo(() => new m.HomeScene(this.ctx));
    }).catch(err => console.error('[MiniGameScene] HomeScene load failed', err));
  }

  unmount(): void {
    this.running = false;
    cancelAnimationFrame(this.frameId);
    this.cleanups.forEach(fn => fn());
    this.cleanups = [];
    this.canvas = null;
    this.gameCtx = null;
  }
}
