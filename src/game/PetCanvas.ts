/**
 * PetCanvas -- 펫 캐릭터를 Canvas에 렌더링하는 컴포넌트
 * HomeScene에서 사용. 펫 + 파티클 + 방 배경을 한 Canvas에 그린다.
 */

import type { PetType, GrowthStage } from '../data/pets';
import { drawPet, createAnimState, updateAnimState, type PetAnimState } from './PetRenderer';
import { ParticleSystem, type ParticleType } from './Particles';
import { getTimeOfDay } from '../data/time-guard';

export class PetCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private anim: PetAnimState;
  private particles: ParticleSystem;
  private frameId = 0;
  private lastTime = 0;
  private W: number;
  private H: number;
  private petType: PetType;
  private stage: GrowthStage;
  private petSize: number;
  private furniture: string[] = [];
  private accessory: string | null = null;
  private season: 'spring' | 'summer' | 'autumn' | 'winter' = 'spring';
  private ambientTimer = 0;

  constructor(
    container: HTMLElement,
    petType: PetType,
    stage: GrowthStage,
    petSize: number,
  ) {
    this.petType = petType;
    this.stage = stage;
    this.petSize = petSize;
    this.anim = createAnimState();
    this.particles = new ParticleSystem();
    this.season = this.getCurrentSeason();

    this.W = Math.min(container.clientWidth || 350, 390);
    this.H = 250;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.W * 2;
    this.canvas.height = this.H * 2;
    this.canvas.style.width = `${this.W}px`;
    this.canvas.style.height = `${this.H}px`;
    this.canvas.className = 'pet-canvas';
    container.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.scale(2, 2);

    // Touch interaction
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * 2;
      const y = (e.clientY - rect.top) * 2;
      this.particles.emit(x / 2, y / 2, 'heart', 3);
      this.particles.emit(x / 2, y / 2, 'sparkle', 4);
    });
  }

  start(): void {
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  stop(): void {
    cancelAnimationFrame(this.frameId);
  }

  setEmotion(emotion: PetAnimState['emotion']): void {
    this.anim.emotion = emotion;
    // Auto-reset after 2s
    setTimeout(() => { this.anim.emotion = 'neutral'; }, 2000);
  }

  emitParticles(type: ParticleType, count: number = 5): void {
    this.particles.emit(this.W / 2, this.H / 2 - 20, type, count);
  }

  updatePet(stage: GrowthStage, size: number): void {
    this.stage = stage;
    this.petSize = size;
  }

  setFurniture(items: string[]): void {
    this.furniture = items;
  }

  setAccessory(acc: string | null): void {
    this.accessory = acc;
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  private loop = (time: number): void => {
    const dt = Math.min((time - this.lastTime) / 1000, 0.05);
    this.lastTime = time;

    updateAnimState(this.anim, dt);
    this.particles.update(dt);

    // Ambient particles (seasonal)
    this.ambientTimer -= dt;
    if (this.ambientTimer <= 0) {
      this.ambientTimer = 0.8 + Math.random() * 0.5;
      this.emitAmbientParticle();
    }

    this.render();
    this.frameId = requestAnimationFrame(this.loop);
  };

  private render(): void {
    const c = this.ctx;
    c.clearRect(0, 0, this.W, this.H);

    // Background
    this.drawBackground(c);

    // Room floor
    this.drawFloor(c);

    // Furniture
    this.drawFurniture(c);

    // Pet
    const cx = this.W / 2;
    const cy = this.H / 2 + 20;
    drawPet(c, this.petType, this.stage, this.anim, cx, cy, this.petSize);

    // Accessory
    if (this.accessory) {
      c.font = '20px Apple Color Emoji, Segoe UI Emoji';
      c.textAlign = 'center';
      c.fillText(this.accessory, cx + this.petSize * 0.25, cy - this.petSize * 0.35 + this.anim.bounceY);
    }

    // Particles
    this.particles.render(c);
  }

  private drawBackground(c: CanvasRenderingContext2D): void {
    const timeOfDay = getTimeOfDay();
    let colors: [string, string];

    switch (timeOfDay) {
      case 'morning':
        colors = ['#FFF5E6', '#FFE8CC'];
        break;
      case 'afternoon':
        colors = ['#E8F4FD', '#FFF5E6'];
        break;
      case 'evening':
        colors = ['#FFD4A3', '#FFAB76'];
        break;
      case 'night':
        colors = ['#1a1a2e', '#16213e'];
        break;
    }

    const grad = c.createLinearGradient(0, 0, 0, this.H);
    grad.addColorStop(0, colors[0]);
    grad.addColorStop(1, colors[1]);
    c.fillStyle = grad;
    c.fillRect(0, 0, this.W, this.H);

    // Window
    if (timeOfDay !== 'night') {
      c.fillStyle = '#87CEEB40';
      c.beginPath();
      this.roundRect(c, this.W - 80, 15, 55, 65, 8);
      c.fill();
      c.strokeStyle = '#D4A57440';
      c.lineWidth = 3;
      c.stroke();
      // Curtains
      c.fillStyle = '#FFB5C230';
      c.fillRect(this.W - 82, 15, 8, 65);
      c.fillRect(this.W - 23, 15, 8, 65);
    } else {
      // Stars in window
      c.fillStyle = '#16213e80';
      c.beginPath();
      this.roundRect(c, this.W - 80, 15, 55, 65, 8);
      c.fill();
      c.fillStyle = '#FFD700';
      for (let i = 0; i < 5; i++) {
        const sx = this.W - 75 + Math.random() * 45;
        const sy = 20 + Math.random() * 55;
        c.beginPath();
        c.arc(sx, sy, 1.5, 0, Math.PI * 2);
        c.fill();
      }
    }

    // Wall decoration
    c.fillStyle = '#FFB5C240';
    c.beginPath();
    this.roundRect(c, 20, 25, 40, 50, 6);
    c.fill();
    c.font = '24px Apple Color Emoji';
    c.textAlign = 'center';
    c.fillText('🖼️', 40, 58);
  }

  private drawFloor(c: CanvasRenderingContext2D): void {
    const floorY = this.H * 0.78;
    const floorGrad = c.createLinearGradient(0, floorY, 0, this.H);
    floorGrad.addColorStop(0, '#D7CCC8');
    floorGrad.addColorStop(1, '#BCAAA4');
    c.fillStyle = floorGrad;
    c.fillRect(0, floorY, this.W, this.H - floorY);

    // Floor pattern (wood planks)
    c.strokeStyle = '#C0B0A0';
    c.lineWidth = 0.5;
    for (let x = 0; x < this.W; x += 50) {
      c.beginPath();
      c.moveTo(x, floorY);
      c.lineTo(x, this.H);
      c.stroke();
    }
  }

  private drawFurniture(c: CanvasRenderingContext2D): void {
    if (this.furniture.length === 0) return;
    c.font = '28px Apple Color Emoji, Segoe UI Emoji';
    c.textAlign = 'center';
    const positions = [
      { x: 45, y: this.H * 0.72 },
      { x: this.W - 45, y: this.H * 0.72 },
      { x: this.W - 55, y: this.H * 0.55 },
    ];
    this.furniture.slice(0, 3).forEach((emoji, i) => {
      const pos = positions[i];
      if (pos) c.fillText(emoji, pos.x, pos.y);
    });
  }

  private emitAmbientParticle(): void {
    switch (this.season) {
      case 'spring':
        this.particles.emitAmbient(this.W, this.H, 'petal');
        break;
      case 'summer':
        // Occasional sparkle
        if (Math.random() < 0.3) {
          this.particles.emitAmbient(this.W, this.H, 'sparkle');
        }
        break;
      case 'autumn':
        this.particles.emitAmbient(this.W, this.H, 'leaf');
        break;
      case 'winter':
        this.particles.emitAmbient(this.W, this.H, 'snowflake');
        break;
    }
  }

  private getCurrentSeason(): 'spring' | 'summer' | 'autumn' | 'winter' {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
  }

  private roundRect(
    c: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, r: number,
  ): void {
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
  }
}
