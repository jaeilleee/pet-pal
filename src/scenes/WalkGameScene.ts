/**
 * WalkGameScene -- 산책 장애물 피하기 미니게임
 * 좌/우 스와이프로 장애물 피하면서 아이템 수집
 */

import type { Scene } from './SceneManager';
import type { AppContext } from '../app/AppContext';
import type { PetPalState } from '../data/state';
import type { SceneManager } from './SceneManager';
import { PETS, getGrowthStage } from '../data/pets';
import { getActivePet, applyEffectsToPet } from '../data/state';
import { updateWeeklyScore } from '../data/daily';
import { drawPet, createAnimState, updateAnimState } from '../game/PetRenderer';
import { showToast } from '../ui/Toast';

type Ctx = AppContext<PetPalState, SceneManager>;

interface WalkObstacle {
  x: number;
  y: number;
  type: 'rock' | 'puddle' | 'bone' | 'coin' | 'butterfly';
  emoji: string;
  collected: boolean;
}

export class WalkGameScene implements Scene {
  private ctx: Ctx;
  private cleanups: Array<() => void> = [];
  private canvas: HTMLCanvasElement | null = null;
  private gc: CanvasRenderingContext2D | null = null;
  private running = false;
  private lane = 1; // 0=left, 1=center, 2=right
  private score = 0;
  private distance = 0;
  private obstacles: WalkObstacle[] = [];
  private frameId = 0;
  private lastTime = 0;
  private speed = 150;
  private lives = 3;
  private W = 0;
  private H = 0;
  private petType: import('../data/pets').PetType;
  private petStage: import('../data/pets').GrowthStage;
  private petAnim = createAnimState();

  constructor(ctx: Ctx) {
    this.ctx = ctx;
    const activePet = getActivePet(ctx.state.current);
    this.petType = activePet?.type ?? 'dog';
    this.petStage = getGrowthStage(this.petType, activePet?.stats.bond ?? 0);
  }

  mount(root: HTMLElement): void {
    root.innerHTML = `
      <div class="scene minigame-scene">
        <div class="mg-header">
          <button class="btn-back" id="btn-back">←</button>
          <div class="mg-score">거리: <span id="walk-dist">0</span>m | 점수: <span id="walk-score">0</span></div>
          <div class="mg-lives" id="walk-lives">❤️❤️❤️</div>
        </div>
        <canvas id="walk-canvas"></canvas>
        <div class="mg-overlay" id="walk-overlay" style="display:none">
          <div class="mg-result">
            <h3>산책 완료!</h3>
            <p><span id="walk-final-dist">0</span>m 산책했어요</p>
            <p>점수: <span id="walk-final-score">0</span></p>
            <p id="walk-reward-text"></p>
            <button class="btn-primary" id="btn-walk-retry">다시하기</button>
            <button class="btn-secondary" id="btn-walk-home">홈으로</button>
          </div>
        </div>
      </div>
    `;

    this.canvas = root.querySelector('#walk-canvas') as HTMLCanvasElement;
    this.W = Math.min(window.innerWidth, 390);
    this.H = Math.min(window.innerHeight - 60, 600);
    this.canvas.width = this.W * 2;
    this.canvas.height = this.H * 2;
    this.canvas.style.width = `${this.W}px`;
    this.canvas.style.height = `${this.H}px`;
    const ctx2d = this.canvas.getContext('2d');
    if (!ctx2d) throw new Error('[WalkGameScene] Failed to get 2d context');
    this.gc = ctx2d;
    this.gc.scale(2, 2);

    this.startGame();

    // Swipe / tap controls
    let touchStartX = 0;
    const touchStart = (e: TouchEvent): void => { touchStartX = e.touches[0].clientX; };
    const touchEnd = (e: TouchEvent): void => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (dx > 40 && this.lane < 2) { this.lane++; this.ctx.sound.playClick(); }
      else if (dx < -40 && this.lane > 0) { this.lane--; this.ctx.sound.playClick(); }
    };
    this.canvas.addEventListener('touchstart', touchStart);
    this.canvas.addEventListener('touchend', touchEnd);
    this.cleanups.push(() => {
      this.canvas?.removeEventListener('touchstart', touchStart);
      this.canvas?.removeEventListener('touchend', touchEnd);
    });

    // Keyboard
    const keyHandler = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowLeft' && this.lane > 0) { this.lane--; this.ctx.sound.playClick(); }
      if (e.key === 'ArrowRight' && this.lane < 2) { this.lane++; this.ctx.sound.playClick(); }
    };
    document.addEventListener('keydown', keyHandler);
    this.cleanups.push(() => document.removeEventListener('keydown', keyHandler));

    // Buttons
    const backBtn = root.querySelector('#btn-back') as HTMLElement;
    const backHandler = (): void => this.goHome();
    backBtn.addEventListener('click', backHandler);
    this.cleanups.push(() => backBtn.removeEventListener('click', backHandler));

    const retryBtn = root.querySelector('#btn-walk-retry') as HTMLElement;
    const retryHandler = (): void => {
      (root.querySelector('#walk-overlay') as HTMLElement).style.display = 'none';
      this.startGame();
    };
    retryBtn.addEventListener('click', retryHandler);
    this.cleanups.push(() => retryBtn.removeEventListener('click', retryHandler));

    const homeBtn = root.querySelector('#btn-walk-home') as HTMLElement;
    const homeHandler = (): void => this.goHome();
    homeBtn.addEventListener('click', homeHandler);
    this.cleanups.push(() => homeBtn.removeEventListener('click', homeHandler));
  }

  private startGame(): void {
    this.score = 0;
    this.distance = 0;
    this.lives = 3;
    this.lane = 1;
    this.speed = 150;
    this.obstacles = [];
    this.running = true;
    this.lastTime = performance.now();
    this.frameId = requestAnimationFrame(this.loop);
  }

  private spawnTimer = 0;
  private loop = (time: number): void => {
    if (!this.running) return;
    const dt = Math.min((time - this.lastTime) / 1000, 0.05);
    this.lastTime = time;

    this.distance += this.speed * dt * 0.01;
    this.speed = Math.min(300, 150 + this.distance * 2);

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnObstacle();
      this.spawnTimer = Math.max(0.5, 1.2 - this.distance * 0.005);
    }

    this.updateObstacles(dt);
    this.render();
    this.updateUI();
    this.frameId = requestAnimationFrame(this.loop);
  };

  private spawnObstacle(): void {
    const lane = Math.floor(Math.random() * 3);
    const r = Math.random();
    let type: WalkObstacle['type'];
    let emoji: string;
    if (r < 0.3) { type = 'rock'; emoji = '🪨'; }
    else if (r < 0.5) { type = 'puddle'; emoji = '💧'; }
    else if (r < 0.7) { type = 'bone'; emoji = '🦴'; }
    else if (r < 0.9) { type = 'coin'; emoji = '💰'; }
    else { type = 'butterfly'; emoji = '🦋'; }

    this.obstacles.push({
      x: this.getLaneX(lane),
      y: -30,
      type, emoji,
      collected: false,
    });
  }

  private getLaneX(lane: number): number {
    return this.W * 0.2 + lane * (this.W * 0.3);
  }

  private updateObstacles(dt: number): void {
    const playerX = this.getLaneX(this.lane);
    const playerY = this.H - 80;

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.y += this.speed * dt;

      if (!obs.collected && obs.y >= playerY - 20 && obs.y <= playerY + 20) {
        if (Math.abs(obs.x - playerX) < 30) {
          obs.collected = true;
          if (obs.type === 'rock' || obs.type === 'puddle') {
            this.lives--;
            this.ctx.sound.playError();
            if (this.lives <= 0) this.endGame();
          } else {
            const points = obs.type === 'coin' ? 15 : obs.type === 'butterfly' ? 20 : 10;
            this.score += points;
            this.ctx.sound.playCoin();
          }
        }
      }

      if (obs.y > this.H + 30) {
        this.obstacles.splice(i, 1);
      }
    }
  }

  private render(): void {
    const c = this.gc!;
    // Background (path)
    const grad = c.createLinearGradient(0, 0, 0, this.H);
    grad.addColorStop(0, '#A5D6A7');
    grad.addColorStop(1, '#81C784');
    c.fillStyle = grad;
    c.fillRect(0, 0, this.W, this.H);

    // Path
    c.fillStyle = '#E0C8A0';
    c.fillRect(this.W * 0.1, 0, this.W * 0.8, this.H);

    // Lane dividers
    c.strokeStyle = '#D4B896';
    c.lineWidth = 1;
    c.setLineDash([10, 10]);
    c.beginPath();
    c.moveTo(this.W * 0.37, 0); c.lineTo(this.W * 0.37, this.H);
    c.moveTo(this.W * 0.63, 0); c.lineTo(this.W * 0.63, this.H);
    c.stroke();
    c.setLineDash([]);

    // Trees on sides
    c.font = '20px Apple Color Emoji';
    c.textAlign = 'center';
    const treeOffset = (this.distance * 50) % 100;
    for (let y = -treeOffset; y < this.H; y += 100) {
      c.fillText('🌳', 25, y);
      c.fillText('🌲', this.W - 25, y + 50);
    }

    // Obstacles
    c.font = '28px Apple Color Emoji';
    for (const obs of this.obstacles) {
      if (!obs.collected) c.fillText(obs.emoji, obs.x, obs.y);
    }

    // Player pet (Canvas 렌더)
    updateAnimState(this.petAnim, 0.016);
    drawPet(c, this.petType, this.petStage, this.petAnim, this.getLaneX(this.lane), this.H - 80, 50);
  }

  private updateUI(): void {
    const dist = document.querySelector('#walk-dist');
    const score = document.querySelector('#walk-score');
    const lives = document.querySelector('#walk-lives');
    if (dist) dist.textContent = Math.floor(this.distance).toString();
    if (score) score.textContent = String(this.score);
    if (lives) lives.textContent = '❤️'.repeat(Math.max(0, this.lives));
  }

  private endGame(): void {
    this.running = false;
    cancelAnimationFrame(this.frameId);

    let state = this.ctx.state.current;
    state.totalMiniGamesPlayed++;
    const goldReward = Math.floor(this.score / 3) + Math.floor(this.distance / 5);
    state.gold += goldReward;
    state.totalGoldEarned += goldReward;
    state = applyEffectsToPet(state, state.activePetIndex, { happiness: 15, bond: 3 });
    // 주간 토너먼트 점수 갱신
    state = updateWeeklyScore(state, this.score);
    this.ctx.state.current = state;
    this.ctx.save.save(state);

    const overlay = document.querySelector('#walk-overlay') as HTMLElement;
    if (overlay) overlay.style.display = 'flex';
    const finalDist = document.querySelector('#walk-final-dist');
    if (finalDist) finalDist.textContent = Math.floor(this.distance).toString();
    const finalScore = document.querySelector('#walk-final-score');
    if (finalScore) finalScore.textContent = String(this.score);
    const rewardText = document.querySelector('#walk-reward-text');
    if (rewardText) rewardText.textContent = `보상: +${goldReward}G`;

    this.ctx.sound.playLevelUp();
  }

  private goHome(): void {
    this.running = false;
    cancelAnimationFrame(this.frameId);
    this.ctx.sound.playClick();
    import('./HomeScene').then(m => {
      this.ctx.scenes.switchTo(() => new m.HomeScene(this.ctx));
    }).catch(err => console.error('[WalkGameScene] HomeScene load failed', err));
  }

  unmount(): void {
    this.running = false;
    cancelAnimationFrame(this.frameId);
    this.cleanups.forEach(fn => fn());
    this.cleanups = [];
  }
}
