/**
 * WalkGameScene -- 산책 장애물 피하기 미니게임
 * 좌/우 스와이프로 장애물 피하면서 아이템 수집
 */

import type { Scene } from './SceneManager';
import type { AppContext } from '../app/AppContext';
import type { PetPalState } from '../data/state';
import type { SceneManager } from './SceneManager';
import { getGrowthStage } from '../data/pets';
import { getActivePet, applyEffectsToPet } from '../data/state';
import { updateWeeklyScore } from '../data/daily';
import { createAnimState, updateAnimState } from '../game/PetRenderer';
import { drawPetSprite } from '../game/PetSprite';
import { showToast } from '../ui/Toast';

type Ctx = AppContext<PetPalState, SceneManager>;

interface WalkObstacle {
  x: number;
  y: number;
  type: 'rock' | 'puddle' | 'bone' | 'coin' | 'butterfly';
  emoji: string;
  collected: boolean;
}

interface CatchEffect {
  x: number;
  y: number;
  emoji: string;
  life: number;
  vy: number;
}

interface Scenery {
  x: number;
  y: number;
  emoji: string;
  side: 'left' | 'right';
  scale: number;
}

export class WalkGameScene implements Scene {
  private ctx: Ctx;
  private cleanups: Array<() => void> = [];
  private canvas: HTMLCanvasElement | null = null;
  private gc: CanvasRenderingContext2D | null = null;
  private running = false;
  private lane = 1; // 0=left, 1=center, 2=right
  private currentLaneX = 0;
  private score = 0;
  private distance = 0;
  private currentStage = 0;
  private stageFlashTimer = 0;
  private obstacles: WalkObstacle[] = [];
  private effects: CatchEffect[] = [];
  private sceneryItems: Scenery[] = [];
  private frameId = 0;
  private lastTime = 0;
  private speed = 150;
  private lives = 3;
  private W = 0;
  private H = 0;
  private hitFlashTimer = 0;
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
          <button class="btn-back" id="btn-back">\u2190</button>
          <div class="mg-score">\uAC70\uB9AC: <span id="walk-dist">0</span>m | \uC810\uC218: <span id="walk-score">0</span></div>
          <div class="mg-lives" id="walk-lives">\u2764\uFE0F\u2764\uFE0F\u2764\uFE0F</div>
        </div>
        <canvas id="walk-canvas"></canvas>
        <div class="mg-overlay" id="walk-overlay" style="display:none">
          <div class="mg-result">
            <h3>\uC0B0\uCC45 \uC644\uB8CC!</h3>
            <p><span id="walk-final-dist">0</span>m \uC0B0\uCC45\uD588\uC5B4\uC694</p>
            <p>\uC810\uC218: <span id="walk-final-score">0</span></p>
            <p id="walk-reward-text"></p>
            <button class="btn-primary" id="btn-walk-retry">\uB2E4\uC2DC\uD558\uAE30</button>
            <button class="btn-secondary" id="btn-walk-home">\uD648\uC73C\uB85C</button>
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

    this.currentLaneX = this.getLaneX(1);
    this.initScenery();
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

  private initScenery(): void {
    const TREES = ['\u{1F333}', '\u{1F332}', '\u{1F334}'];
    const FLOWERS = ['\u{1F33B}', '\u{1F337}', '\u{1F33A}', '\u{1F490}'];
    this.sceneryItems = [];
    for (let y = 0; y < this.H + 100; y += 50 + Math.random() * 40) {
      // Left side
      this.sceneryItems.push({
        x: 5 + Math.random() * 20,
        y,
        emoji: Math.random() < 0.7 ? TREES[Math.floor(Math.random() * TREES.length)] : FLOWERS[Math.floor(Math.random() * FLOWERS.length)],
        side: 'left',
        scale: 0.7 + Math.random() * 0.5,
      });
      // Right side
      this.sceneryItems.push({
        x: this.W - 25 + Math.random() * 20,
        y: y + 25 + Math.random() * 20,
        emoji: Math.random() < 0.7 ? TREES[Math.floor(Math.random() * TREES.length)] : FLOWERS[Math.floor(Math.random() * FLOWERS.length)],
        side: 'right',
        scale: 0.7 + Math.random() * 0.5,
      });
    }
  }

  private startGame(): void {
    this.score = 0;
    this.distance = 0;
    this.lives = 3;
    this.lane = 1;
    this.currentLaneX = this.getLaneX(1);
    this.speed = 150;
    this.obstacles = [];
    this.effects = [];
    this.currentStage = 0;
    this.stageFlashTimer = 0;
    this.hitFlashTimer = 0;
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

    // Lerp lane position
    const targetX = this.getLaneX(this.lane);
    this.currentLaneX += (targetX - this.currentLaneX) * 0.12;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnObstacle();
      this.spawnTimer = Math.max(0.5, 1.2 - this.distance * 0.005);
    }

    if (this.stageFlashTimer > 0) this.stageFlashTimer -= dt;
    if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;

    this.updateObstacles(dt);
    this.updateEffects(dt);
    this.updateScenery(dt);
    this.render();
    this.updateUI();
    this.frameId = requestAnimationFrame(this.loop);
  };

  private spawnObstacle(): void {
    const lane = Math.floor(Math.random() * 3);
    const r = Math.random();
    let type: WalkObstacle['type'];
    let emoji: string;
    if (r < 0.3) { type = 'rock'; emoji = '\u{1FAA8}'; }
    else if (r < 0.5) { type = 'puddle'; emoji = '\u{1F4A7}'; }
    else if (r < 0.7) { type = 'bone'; emoji = '\u{1F9B4}'; }
    else if (r < 0.9) { type = 'coin'; emoji = '\u{1F4B0}'; }
    else { type = 'butterfly'; emoji = '\u{1F98B}'; }

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
    const playerY = this.H - 80;

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.y += this.speed * dt;

      if (!obs.collected && obs.y >= playerY - 20 && obs.y <= playerY + 20) {
        if (Math.abs(obs.x - this.currentLaneX) < 30) {
          obs.collected = true;
          if (obs.type === 'rock' || obs.type === 'puddle') {
            this.lives--;
            this.ctx.sound.playError();
            this.hitFlashTimer = 0.15; // red flash
            if (this.lives <= 0) this.endGame();
          } else {
            const points = obs.type === 'coin' ? 15 : obs.type === 'butterfly' ? 20 : 10;
            this.score += points;
            this.ctx.sound.playCoin();
            // Catch effect: emoji floats up
            this.effects.push({
              x: obs.x,
              y: obs.y,
              emoji: `+${points}`,
              life: 0.5,
              vy: -80,
            });
            // Stage check (50 points each)
            const newStage = Math.floor(this.score / 50);
            if (newStage > this.currentStage) {
              this.currentStage = newStage;
              this.stageFlashTimer = 2.0;
              const isBonusStage = this.currentStage % 5 === 0;
              showToast(`Stage ${this.currentStage} Clear! ${isBonusStage ? '\u{1F31F} \uBCF4\uB108\uC2A4 x2!' : '\u{1F389}'}`);
              this.ctx.sound.playLevelUp();
            }
          }
        }
      }

      if (obs.y > this.H + 30) {
        this.obstacles.splice(i, 1);
      }
    }
  }

  private updateEffects(dt: number): void {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const ef = this.effects[i];
      ef.y += ef.vy * dt;
      ef.life -= dt;
      if (ef.life <= 0) {
        this.effects.splice(i, 1);
      }
    }
  }

  private updateScenery(dt: number): void {
    const scrollSpeed = this.speed * dt;
    for (const s of this.sceneryItems) {
      s.y += scrollSpeed;
      if (s.y > this.H + 40) {
        s.y -= this.H + 140;
        // Re-randomize
        s.scale = 0.7 + Math.random() * 0.5;
      }
    }
  }

  private render(): void {
    const c = this.gc!;

    // Hit flash overlay
    if (this.hitFlashTimer > 0) {
      // Background with red tint
      c.fillStyle = '#A5D6A7';
      c.fillRect(0, 0, this.W, this.H);
      c.fillStyle = `rgba(255, 0, 0, ${Math.min(0.3, this.hitFlashTimer * 2)})`;
      c.fillRect(0, 0, this.W, this.H);
    } else {
      // Normal background (path)
      const grad = c.createLinearGradient(0, 0, 0, this.H);
      grad.addColorStop(0, '#A5D6A7');
      grad.addColorStop(1, '#81C784');
      c.fillStyle = grad;
      c.fillRect(0, 0, this.W, this.H);
    }

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

    // Scenery on sides (trees/flowers with variety)
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (const s of this.sceneryItems) {
      if (s.y < -30 || s.y > this.H + 30) continue;
      c.save();
      c.translate(s.x, s.y);
      const fontSize = Math.floor(20 * s.scale);
      c.font = `${fontSize}px Apple Color Emoji`;
      c.fillText(s.emoji, 0, 0);
      c.restore();
    }

    // Obstacles
    c.font = '28px Apple Color Emoji';
    for (const obs of this.obstacles) {
      if (!obs.collected) c.fillText(obs.emoji, obs.x, obs.y);
    }

    // Catch effects (floating score text)
    for (const ef of this.effects) {
      const alpha = Math.max(0, ef.life * 2);
      c.save();
      c.globalAlpha = alpha;
      c.font = 'bold 18px Nunito, sans-serif';
      c.fillStyle = '#FFD600';
      c.strokeStyle = '#E64A19';
      c.lineWidth = 2;
      c.strokeText(ef.emoji, ef.x, ef.y);
      c.fillText(ef.emoji, ef.x, ef.y);
      c.restore();
    }

    // Player pet (Canvas render) -- uses lerped currentLaneX
    updateAnimState(this.petAnim, 0.016);
    drawPetSprite(c, this.petType, this.petStage, this.currentLaneX, this.H - 80, 50, {
      bounceY: this.petAnim.bounceY,
      scale: this.petAnim.breathScale,
    });

    // Stage display (top-left)
    if (this.currentStage > 0) {
      c.font = 'bold 14px Quicksand, sans-serif';
      c.textAlign = 'left';
      c.fillStyle = '#FF7043';
      c.fillText(`Stage ${this.currentStage}`, 10, 30);
    }

    // Stage clear flash
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
        ? `Stage ${this.currentStage} \u{1F31F} x2!`
        : `Stage ${this.currentStage} Clear!`;
      c.strokeText(text, this.W / 2, this.H / 3);
      c.fillText(text, this.W / 2, this.H / 3);
      c.restore();
    }
  }

  private updateUI(): void {
    const dist = document.querySelector('#walk-dist');
    const score = document.querySelector('#walk-score');
    const lives = document.querySelector('#walk-lives');
    if (dist) dist.textContent = Math.floor(this.distance).toString();
    if (score) score.textContent = String(this.score);
    if (lives) lives.textContent = '\u2764\uFE0F'.repeat(Math.max(0, this.lives));
  }

  private endGame(): void {
    this.running = false;
    cancelAnimationFrame(this.frameId);

    let state = this.ctx.state.current;
    state.totalMiniGamesPlayed++;

    // Stage bonus
    const bonusStages = Math.floor(this.currentStage / 5);
    let goldReward = Math.floor(this.score / 3) + Math.floor(this.distance / 5);
    if (bonusStages > 0) goldReward = Math.floor(goldReward * (1 + bonusStages * 0.5));

    state.gold += goldReward;
    state.totalGoldEarned += goldReward;
    state = applyEffectsToPet(state, state.activePetIndex, { happiness: 15, bond: 3 });
    state = updateWeeklyScore(state, this.score);
    if (this.currentStage > state.walkGameMaxStage) {
      state.walkGameMaxStage = this.currentStage;
    }
    this.ctx.state.current = state;
    this.ctx.save.save(state);

    const overlay = document.querySelector('#walk-overlay') as HTMLElement;
    if (overlay) overlay.style.display = 'flex';
    const finalDist = document.querySelector('#walk-final-dist');
    if (finalDist) finalDist.textContent = Math.floor(this.distance).toString();
    const finalScore = document.querySelector('#walk-final-score');
    if (finalScore) finalScore.textContent = String(this.score);
    const stageLabel = this.currentStage > 0 ? ` | \uC2A4\uD14C\uC774\uC9C0 ${this.currentStage} \uB2EC\uC131!` : '';
    const rewardText = document.querySelector('#walk-reward-text');
    if (rewardText) rewardText.textContent = `\uBCF4\uC0C1: +${goldReward}G${stageLabel}`;

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
