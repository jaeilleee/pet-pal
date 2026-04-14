/**
 * PetCanvas -- 인터랙티브 펫 Canvas
 * 클릭→이동, 터치 영역별 반응, 자발적 감정, 말풍선, 방 배경
 */

import type { PetType, GrowthStage } from '../data/pets';
import type { PetStats } from '../data/state';
import { drawPet, createAnimState, updateAnimState, type PetAnimState } from './PetRenderer';
import { ParticleSystem, type ParticleType } from './Particles';
import { getTimeOfDay } from '../data/time-guard';

/** 말풍선 콜백 */
export type SpeechCallback = (text: string) => void;

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

  // 인터랙티브: 펫 위치 + 이동
  private petX: number;
  private petY: number;
  private targetX: number;
  private targetY: number;
  private isMoving = false;
  private moveSpeed = 60; // px/s
  private facingLeft = false;

  // 자발적 감정
  private petStats: PetStats | null = null;
  private idleEmotionTimer = 0;
  private speechTimer = 0;
  private onSpeech: SpeechCallback | null = null;

  // 말풍선
  private speechText = '';
  private speechAlpha = 0;

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
    this.H = Math.min(container.clientHeight || 180, 180);

    // 펫 초기 위치 (중앙)
    this.petX = this.W / 2;
    this.petY = this.H * 0.55;
    this.targetX = this.petX;
    this.targetY = this.petY;

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.W * 2;
    this.canvas.height = this.H * 2;
    this.canvas.style.width = `${this.W}px`;
    this.canvas.style.height = `${this.H}px`;
    this.canvas.className = 'pet-canvas';
    container.appendChild(this.canvas);

    const ctx2d = this.canvas.getContext('2d');
    if (!ctx2d) throw new Error('PetCanvas: 2d context unavailable');
    this.ctx = ctx2d;
    this.ctx.scale(2, 2);

    // 클릭→이동 + 터치 반응
    this.canvas.addEventListener('click', (e) => this.handleClick(e));
  }

  private handleClick(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // 펫 영역 판정 (반경 체크)
    const dx = clickX - this.petX;
    const dy = clickY - this.petY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const hitRadius = this.petSize * 0.5;

    if (dist < hitRadius) {
      // 펫 터치! 영역별 반응
      this.handlePetTouch(clickX, clickY);
    } else {
      // 바닥 클릭 → 펫이 그쪽으로 이동
      const floorY = this.H * 0.78;
      const clampedY = Math.min(clickY, floorY - 10);
      const clampedX = Math.max(30, Math.min(this.W - 30, clickX));
      this.targetX = clampedX;
      this.targetY = Math.max(this.H * 0.35, clampedY);
      this.isMoving = true;
      this.facingLeft = this.targetX < this.petX;
      // 발자국 파티클
      this.particles.emit(this.petX, this.petY + 15, 'sparkle', 2);
    }
  }

  private handlePetTouch(x: number, y: number): void {
    const headY = this.petY - this.petSize * 0.25;

    if (y < headY) {
      // 머리 터치 → 쓰다듬기
      this.setEmotion('love');
      this.showSpeech('기분 좋아~! ❤️');
      this.particles.emit(x, y, 'heart', 5);
    } else if (y > this.petY + this.petSize * 0.15) {
      // 발/아래 터치 → 간지럽
      this.setEmotion('happy');
      this.showSpeech('간지러워! 😆');
      this.particles.emit(x, y, 'star', 4);
    } else {
      // 몸통 터치 → 안기
      this.setEmotion('love');
      this.showSpeech('따뜻해~! 🥰');
      this.particles.emit(x, y, 'heart', 3);
      this.particles.emit(x, y, 'sparkle', 3);
    }
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
    setTimeout(() => {
      if (this.anim.emotion === emotion) this.anim.emotion = 'neutral';
    }, 2500);
  }

  showSpeech(text: string): void {
    this.speechText = text;
    this.speechAlpha = 1;
    this.speechTimer = 2.5;
    this.onSpeech?.(text);
  }

  emitParticles(type: ParticleType, count: number = 5): void {
    this.particles.emit(this.petX, this.petY - 10, type, count);
  }

  updatePet(stage: GrowthStage, size: number): void {
    this.stage = stage;
    this.petSize = size;
  }

  /** 스탯 연동 — 자발적 감정에 사용 */
  setStats(stats: PetStats): void {
    this.petStats = stats;
  }

  setSpeechCallback(cb: SpeechCallback): void {
    this.onSpeech = cb;
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
    this.updateMovement(dt);
    this.updateIdleEmotion(dt);
    this.updateSpeech(dt);

    // Ambient particles
    this.ambientTimer -= dt;
    if (this.ambientTimer <= 0) {
      this.ambientTimer = 1.0 + Math.random() * 0.8;
      this.emitAmbientParticle();
    }

    this.render();
    this.frameId = requestAnimationFrame(this.loop);
  };

  private updateMovement(dt: number): void {
    if (!this.isMoving) return;

    const dx = this.targetX - this.petX;
    const dy = this.targetY - this.petY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 3) {
      this.petX = this.targetX;
      this.petY = this.targetY;
      this.isMoving = false;
      return;
    }

    const step = this.moveSpeed * dt;
    this.petX += (dx / dist) * step;
    this.petY += (dy / dist) * step;
    this.facingLeft = dx < 0;
  }

  /** 스탯 기반 자발적 감정 */
  private updateIdleEmotion(dt: number): void {
    if (!this.petStats) return;
    this.idleEmotionTimer -= dt;
    if (this.idleEmotionTimer > 0) return;
    this.idleEmotionTimer = 8 + Math.random() * 12;

    // neutral 상태일 때만 자발적 감정
    if (this.anim.emotion !== 'neutral') return;

    const s = this.petStats;
    if (s.hunger < 25) {
      this.showSpeech('배고파... 🍖');
      this.setEmotion('eating');
    } else if (s.happiness < 25) {
      this.showSpeech('심심해... 😔');
    } else if (s.cleanliness < 25) {
      this.showSpeech('더러워... 🛁');
    } else if (s.energy < 20) {
      this.showSpeech('졸려... 💤');
      this.setEmotion('sleeping');
    } else if (s.happiness > 80 && Math.random() < 0.5) {
      this.showSpeech(['기분 좋아! 😊', '놀자! 🎾', '사랑해! ❤️'][Math.floor(Math.random() * 3)]);
      this.setEmotion('happy');
    } else if (Math.random() < 0.3) {
      // 랜덤 자발적 행동: 방 안 걸어다니기
      this.targetX = 40 + Math.random() * (this.W - 80);
      this.targetY = this.H * 0.4 + Math.random() * (this.H * 0.3);
      this.isMoving = true;
      this.facingLeft = this.targetX < this.petX;
    }
  }

  private updateSpeech(dt: number): void {
    if (this.speechTimer > 0) {
      this.speechTimer -= dt;
      if (this.speechTimer <= 0.5) {
        this.speechAlpha = Math.max(0, this.speechTimer / 0.5);
      }
    }
  }

  private render(): void {
    const c = this.ctx;
    c.clearRect(0, 0, this.W, this.H);

    this.drawBackground(c);
    this.drawFloor(c);
    this.drawFurniture(c);

    // Pet (좌우 반전 지원)
    c.save();
    if (this.facingLeft) {
      c.translate(this.petX, 0);
      c.scale(-1, 1);
      c.translate(-this.petX, 0);
    }
    drawPet(c, this.petType, this.stage, this.anim, this.petX, this.petY, this.petSize);
    c.restore();

    // Accessory
    if (this.accessory) {
      c.font = '16px Apple Color Emoji, Segoe UI Emoji';
      c.textAlign = 'center';
      c.fillText(this.accessory, this.petX + this.petSize * 0.2, this.petY - this.petSize * 0.3 + this.anim.bounceY);
    }

    // 이동 중 발자국
    if (this.isMoving) {
      c.fillStyle = 'rgba(0,0,0,0.05)';
      c.beginPath();
      c.arc(this.petX, this.petY + this.petSize * 0.3, 3, 0, Math.PI * 2);
      c.fill();
    }

    // 말풍선
    if (this.speechTimer > 0 && this.speechAlpha > 0) {
      this.drawSpeechBubble(c);
    }

    this.particles.render(c);
  }

  private drawSpeechBubble(c: CanvasRenderingContext2D): void {
    c.globalAlpha = this.speechAlpha;
    const bubbleX = this.petX;
    const bubbleY = this.petY - this.petSize * 0.5 - 20;

    c.font = '12px Quicksand, sans-serif';
    const metrics = c.measureText(this.speechText);
    const pw = metrics.width + 16;
    const ph = 22;

    // Bubble bg
    c.fillStyle = 'rgba(255,255,255,0.95)';
    c.beginPath();
    this.roundRect(c, bubbleX - pw / 2, bubbleY - ph / 2, pw, ph, 10);
    c.fill();
    c.shadowColor = 'transparent';

    // Tail
    c.beginPath();
    c.moveTo(bubbleX - 5, bubbleY + ph / 2);
    c.lineTo(bubbleX, bubbleY + ph / 2 + 6);
    c.lineTo(bubbleX + 5, bubbleY + ph / 2);
    c.fill();

    // Text
    c.fillStyle = '#3D3D3D';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(this.speechText, bubbleX, bubbleY);

    c.globalAlpha = 1;
  }

  private drawBackground(c: CanvasRenderingContext2D): void {
    const timeOfDay = getTimeOfDay();
    let colors: [string, string];
    switch (timeOfDay) {
      case 'morning': colors = ['#FFF5E6', '#FFE8CC']; break;
      case 'afternoon': colors = ['#E8F4FD', '#FFF5E6']; break;
      case 'evening': colors = ['#FFD4A3', '#FFAB76']; break;
      case 'night': colors = ['#1a1a2e', '#16213e']; break;
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
      this.roundRect(c, this.W - 80, 10, 55, 55, 8);
      c.fill();
      c.strokeStyle = '#D4A57440';
      c.lineWidth = 2;
      c.stroke();
      c.fillStyle = '#FFB5C230';
      c.fillRect(this.W - 82, 10, 6, 55);
      c.fillRect(this.W - 23, 10, 6, 55);
    } else {
      c.fillStyle = '#16213e80';
      c.beginPath();
      this.roundRect(c, this.W - 80, 10, 55, 55, 8);
      c.fill();
      c.fillStyle = '#FFD700';
      for (let i = 0; i < 4; i++) {
        c.beginPath();
        c.arc(this.W - 72 + i * 12, 20 + (i % 2) * 20, 1.5, 0, Math.PI * 2);
        c.fill();
      }
    }

    // Wall picture
    c.fillStyle = '#FFB5C240';
    c.beginPath();
    this.roundRect(c, 15, 18, 35, 42, 5);
    c.fill();
    c.font = '18px Apple Color Emoji';
    c.textAlign = 'center';
    c.fillText('🖼️', 32, 44);
  }

  private drawFloor(c: CanvasRenderingContext2D): void {
    const floorY = this.H * 0.78;
    const floorGrad = c.createLinearGradient(0, floorY, 0, this.H);
    floorGrad.addColorStop(0, '#D7CCC8');
    floorGrad.addColorStop(1, '#BCAAA4');
    c.fillStyle = floorGrad;
    c.fillRect(0, floorY, this.W, this.H - floorY);
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
    c.font = '24px Apple Color Emoji, Segoe UI Emoji';
    c.textAlign = 'center';
    const positions = [
      { x: 40, y: this.H * 0.72 },
      { x: this.W - 40, y: this.H * 0.72 },
      { x: this.W - 50, y: this.H * 0.50 },
    ];
    this.furniture.slice(0, 3).forEach((emoji, i) => {
      const pos = positions[i];
      if (pos) c.fillText(emoji, pos.x, pos.y);
    });
  }

  private emitAmbientParticle(): void {
    switch (this.season) {
      case 'spring': this.particles.emitAmbient(this.W, this.H, 'petal'); break;
      case 'summer': if (Math.random() < 0.3) this.particles.emitAmbient(this.W, this.H, 'sparkle'); break;
      case 'autumn': this.particles.emitAmbient(this.W, this.H, 'leaf'); break;
      case 'winter': this.particles.emitAmbient(this.W, this.H, 'snowflake'); break;
    }
  }

  private getCurrentSeason(): 'spring' | 'summer' | 'autumn' | 'winter' {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
  }

  private roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
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
