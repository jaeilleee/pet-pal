/**
 * MiniGameScene -- 먹이 캐치 미니게임 (Canvas)
 * 하늘에서 떨어지는 먹이를 좌우 이동으로 받기
 */

import type { Scene } from './SceneManager';
import type { AppContext } from '../app/AppContext';
import type { PetPalState } from '../data/state';
import type { SceneManager } from './SceneManager';
import { applyEffectsToPet, getActivePet } from '../data/state';
import { getGrowthStage } from '../data/pets';
import { updateWeeklyScore } from '../data/daily';
import { drawPetSprite } from '../game/PetSprite';
import { showToast } from '../ui/Toast';

type Ctx = AppContext<PetPalState, SceneManager>;

interface FallingItem {
  x: number;
  y: number;
  emoji: string;
  speed: number;
  points: number;
  isBad: boolean;
  rotation: number;
  rotSpeed: number;
  scale: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface Cloud {
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
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
  private targetPlayerX = 0;
  private items: FallingItem[] = [];
  private particles: Particle[] = [];
  private frameId = 0;
  private spawnTimer = 0;
  private elapsed = 0;
  private W = 0;
  private H = 0;
  private combo = 0;
  private comboFlashTimer = 0;
  private shakeTimer = 0;
  private shakeIntensity = 0;
  private clouds: Cloud[] = [];

  // Pet info for player sprite
  private petType: import('../data/pets').PetType = 'dog';
  private petStage: import('../data/pets').GrowthStage = 'baby';

  constructor(ctx: Ctx) {
    this.ctx = ctx;
    const pet = getActivePet(ctx.state.current);
    if (pet) {
      this.petType = pet.type;
      this.petStage = getGrowthStage(pet.type, pet.stats.bond);
    }
  }

  mount(root: HTMLElement): void {
    root.innerHTML = `
      <div class="scene minigame-scene">
        <div class="mg-header">
          <button class="btn-back" id="btn-back">\u2190</button>
          <div class="mg-score">점수: <span id="mg-score">0</span></div>
          <div class="mg-lives" id="mg-lives">\u2764\uFE0F\u2764\uFE0F\u2764\uFE0F</div>
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
    this.targetPlayerX = this.W / 2;
    this.initClouds();
    this.startGame();

    // touch/mouse control
    const moveHandler = (e: TouchEvent | MouseEvent): void => {
      e.preventDefault();
      const rect = this.canvas!.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      this.targetPlayerX = Math.max(25, Math.min(this.W - 25, clientX - rect.left));
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

  private initClouds(): void {
    this.clouds = [
      { x: 50, y: 40, w: 60, h: 25, speed: 8 },
      { x: 200, y: 70, w: 80, h: 30, speed: 12 },
      { x: 320, y: 35, w: 50, h: 20, speed: 6 },
    ];
  }

  private startGame(): void {
    this.score = 0;
    this.lives = 3;
    this.currentStage = 0;
    this.lastStageScore = 0;
    this.stageFlashTimer = 0;
    this.items = [];
    this.particles = [];
    this.spawnTimer = 0;
    this.elapsed = 0;
    this.combo = 0;
    this.comboFlashTimer = 0;
    this.shakeTimer = 0;
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

    // Lerp player position
    this.playerX += (this.targetPlayerX - this.playerX) * 0.15;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnItem();
      this.spawnTimer = Math.max(0.4, 1.2 - this.elapsed * 0.01);
    }

    if (this.stageFlashTimer > 0) this.stageFlashTimer -= dt;
    if (this.comboFlashTimer > 0) this.comboFlashTimer -= dt;
    if (this.shakeTimer > 0) this.shakeTimer -= dt;

    this.updateItems(dt);
    this.updateParticles(dt);
    this.updateClouds(dt);
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
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 4,
      scale: 0.8 + Math.random() * 0.4,
    });
  }

  private spawnParticles(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
      const speed = 60 + Math.random() * 80;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        life: 0.5 + Math.random() * 0.3,
        maxLife: 0.8,
        color,
        size: 3 + Math.random() * 3,
      });
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 200 * dt; // gravity
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  private updateClouds(dt: number): void {
    for (const cloud of this.clouds) {
      cloud.x = (cloud.x + cloud.speed * dt) % (this.W + 100);
    }
  }

  private updateItems(dt: number): void {
    const catchY = this.H - 60;
    const catchRadius = 35;

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.y += item.speed * dt;
      item.rotation += item.rotSpeed * dt;

      // catch check
      if (item.y >= catchY - 10 && item.y <= catchY + 20) {
        if (Math.abs(item.x - this.playerX) < catchRadius) {
          if (item.isBad) {
            this.lives--;
            this.combo = 0;
            this.ctx.sound.playError();
            // Red X particles + screen shake
            this.spawnParticles(item.x, item.y, '#FF5252', 5);
            this.shakeTimer = 0.15;
            this.shakeIntensity = 4;
          } else {
            this.score += item.points;
            this.combo++;
            this.ctx.sound.playCoin();
            // Gold particles on catch
            this.spawnParticles(item.x, item.y, '#FFD700', 6);

            // Combo bonus check
            if (this.combo > 0 && this.combo % 5 === 0) {
              const comboBonus = 20;
              this.score += comboBonus;
              this.comboFlashTimer = 1.0;
              showToast(`${this.combo} Combo! +${comboBonus} bonus`);
            }

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
          this.items.splice(i, 1);
          this.updateUI();
          if (this.lives <= 0) this.endGame();
          continue;
        }
      }

      // missed good item
      if (item.y > this.H + 20) {
        if (!item.isBad) {
          this.combo = 0; // miss resets combo
        }
        this.items.splice(i, 1);
      }
    }
  }

  private render(): void {
    const c = this.gameCtx;
    if (!c) return;

    c.save();

    // Screen shake
    if (this.shakeTimer > 0) {
      const sx = (Math.random() - 0.5) * this.shakeIntensity * 2;
      const sy = (Math.random() - 0.5) * this.shakeIntensity * 2;
      c.translate(sx, sy);
    }

    // Sky gradient
    const grad = c.createLinearGradient(0, 0, 0, this.H);
    grad.addColorStop(0, '#87CEEB');
    grad.addColorStop(0.6, '#E8F4FD');
    grad.addColorStop(1, '#FFF5E6');
    c.fillStyle = grad;
    c.fillRect(-5, -5, this.W + 10, this.H + 10);

    // Clouds
    this.renderClouds(c);

    // Hills/mountains silhouette
    this.renderHills(c);

    // Ground with grass
    this.renderGround(c);

    // Falling items with rotation and scale
    for (const item of this.items) {
      c.save();
      c.translate(item.x, item.y);
      c.rotate(item.rotation);
      c.scale(item.scale, item.scale);
      c.font = '28px Apple Color Emoji, Segoe UI Emoji';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(item.emoji, 0, 0);
      c.restore();
    }

    // Particles
    this.renderParticles(c);

    // Player pet sprite
    const pet = getActivePet(this.ctx.state.current);
    if (pet) {
      const stage = getGrowthStage(pet.type, pet.stats.bond);
      drawPetSprite(c, pet.type, stage, this.playerX, this.H - 55, 50);
    } else {
      drawPetSprite(c, this.petType, this.petStage, this.playerX, this.H - 55, 50);
    }
    // Bowl on top of pet head
    c.font = '18px Apple Color Emoji, Segoe UI Emoji';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('\u{1F963}', this.playerX, this.H - 85);

    // Stage display (top-left)
    if (this.currentStage > 0) {
      c.font = 'bold 14px Quicksand, sans-serif';
      c.textAlign = 'left';
      c.fillStyle = '#FF7043';
      c.fillText(`Stage ${this.currentStage}`, 10, 30);
    }

    // Combo counter (top-right area)
    if (this.combo >= 2) {
      c.font = 'bold 16px Nunito, sans-serif';
      c.textAlign = 'right';
      const comboAlpha = this.comboFlashTimer > 0 ? 1 : 0.8;
      c.fillStyle = `rgba(255, 87, 34, ${comboAlpha})`;
      c.fillText(`${this.combo} Combo!`, this.W - 10, 30);
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

    c.restore(); // end shake transform
  }

  private renderClouds(c: CanvasRenderingContext2D): void {
    c.fillStyle = 'rgba(255, 255, 255, 0.7)';
    for (const cloud of this.clouds) {
      // Draw fluffy cloud with overlapping ellipses
      c.beginPath();
      c.ellipse(cloud.x, cloud.y, cloud.w / 2, cloud.h / 2, 0, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.ellipse(cloud.x - cloud.w * 0.25, cloud.y + 3, cloud.w * 0.3, cloud.h * 0.4, 0, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.ellipse(cloud.x + cloud.w * 0.25, cloud.y + 2, cloud.w * 0.35, cloud.h * 0.45, 0, 0, Math.PI * 2);
      c.fill();
    }
  }

  private renderHills(c: CanvasRenderingContext2D): void {
    // Back hill
    c.fillStyle = '#A5D6A7';
    c.beginPath();
    c.moveTo(0, this.H - 15);
    c.quadraticCurveTo(this.W * 0.25, this.H - 55, this.W * 0.5, this.H - 20);
    c.quadraticCurveTo(this.W * 0.75, this.H - 45, this.W, this.H - 15);
    c.lineTo(this.W, this.H);
    c.lineTo(0, this.H);
    c.closePath();
    c.fill();

    // Front hill
    c.fillStyle = '#81C784';
    c.beginPath();
    c.moveTo(0, this.H - 10);
    c.quadraticCurveTo(this.W * 0.3, this.H - 35, this.W * 0.6, this.H - 12);
    c.quadraticCurveTo(this.W * 0.85, this.H - 28, this.W, this.H - 8);
    c.lineTo(this.W, this.H);
    c.lineTo(0, this.H);
    c.closePath();
    c.fill();
  }

  private renderGround(c: CanvasRenderingContext2D): void {
    c.fillStyle = '#66BB6A';
    c.fillRect(0, this.H - 12, this.W, 12);

    // Grass blades
    c.strokeStyle = '#43A047';
    c.lineWidth = 1.5;
    for (let x = 5; x < this.W; x += 12) {
      const h = 4 + Math.sin(x * 0.3 + this.elapsed * 2) * 3;
      c.beginPath();
      c.moveTo(x, this.H - 12);
      c.lineTo(x - 2, this.H - 12 - h);
      c.stroke();
      c.beginPath();
      c.moveTo(x + 4, this.H - 12);
      c.lineTo(x + 6, this.H - 12 - h * 0.8);
      c.stroke();
    }
  }

  private renderParticles(c: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      c.globalAlpha = alpha;
      c.fillStyle = p.color;
      c.beginPath();
      c.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
  }

  private updateUI(): void {
    const scoreEl = document.querySelector('#mg-score');
    if (scoreEl) scoreEl.textContent = String(this.score);

    const livesEl = document.querySelector('#mg-lives');
    if (livesEl) livesEl.textContent = '\u2764\uFE0F'.repeat(Math.max(0, this.lives));
  }

  private endGame(): void {
    this.running = false;
    cancelAnimationFrame(this.frameId);

    let state = this.ctx.state.current;
    state.totalMiniGamesPlayed++;
    const isHighScore = this.score > state.miniGameHighScore;
    if (isHighScore) state.miniGameHighScore = this.score;

    // Stage bonus: x2 every 5 stages
    const bonusStages = Math.floor(this.currentStage / 5);
    let goldReward = Math.floor(this.score / 3);
    if (bonusStages > 0) goldReward = Math.floor(goldReward * (1 + bonusStages * 0.5));

    state.gold += goldReward;
    state.totalGoldEarned += goldReward;
    state = applyEffectsToPet(state, state.activePetIndex, { happiness: 10, bond: 2 });
    state = updateWeeklyScore(state, this.score);
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
    const stageLabel = this.currentStage > 0 ? ` | \uC2A4\uD14C\uC774\uC9C0 ${this.currentStage} \uB2EC\uC131!` : '';
    if (rewardText) rewardText.textContent = `\uBCF4\uC0C1: +${goldReward}G${stageLabel} ${isHighScore ? '\u{1F3C6} \uCD5C\uACE0\uAE30\uB85D!' : ''}`;
    if (title) title.textContent = isHighScore ? '\uCD5C\uACE0\uAE30\uB85D!' : '\uAC8C\uC784 \uC624\uBC84';

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
