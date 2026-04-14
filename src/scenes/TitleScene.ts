/**
 * TitleScene -- 타이틀 화면 (Canvas 펫 3마리 대형 렌더)
 */

import type { Scene } from './SceneManager';
import type { AppContext } from '../app/AppContext';
import type { PetPalState } from '../data/state';
import type { SceneManager } from './SceneManager';
import { drawPet, createAnimState, updateAnimState, type PetAnimState } from '../game/PetRenderer';
import type { PetType, GrowthStage } from '../data/pets';

type Ctx = AppContext<PetPalState, SceneManager>;

interface TitlePet {
  type: PetType;
  stage: GrowthStage;
  anim: PetAnimState;
  x: number;
  y: number;
  size: number;
}

export class TitleScene implements Scene {
  private ctx: Ctx;
  private cleanups: Array<() => void> = [];

  constructor(ctx: Ctx) {
    this.ctx = ctx;
  }

  mount(root: HTMLElement): void {
    root.innerHTML = `
      <div class="scene title-scene">
        <div class="title-bg">
          <div class="title-content">
            <div class="title-logo">
              <div id="title-pet-canvas" style="height:160px;margin-bottom:12px;"></div>
              <h1 class="title-text">PetPal</h1>
              <p class="title-sub">나만의 반려동물 키우기</p>
            </div>
            <button class="btn-primary title-start-btn" id="btn-start">
              시작하기
            </button>
            <p class="title-version">v2.1.0</p>
          </div>
        </div>
      </div>
    `;

    // Canvas 3마리 펫 렌더
    this.setupTitleCanvas(root);

    const btn = root.querySelector('#btn-start') as HTMLButtonElement;
    const handler = (): void => {
      this.ctx.sound.ensureContext();
      this.ctx.sound.playClick();

      const state = this.ctx.state.current;
      if (state.pets.length > 0) {
        import('./HomeScene').then(m => {
          this.ctx.scenes.switchTo(() => new m.HomeScene(this.ctx));
        }).catch(err => console.error('[TitleScene] load failed', err));
      } else {
        import('./PetSelectScene').then(m => {
          this.ctx.scenes.switchTo(() => new m.PetSelectScene(this.ctx));
        }).catch(err => console.error('[TitleScene] load failed', err));
      }
    };
    btn.addEventListener('click', handler);
    this.cleanups.push(() => btn.removeEventListener('click', handler));
  }

  private setupTitleCanvas(root: HTMLElement): void {
    const container = root.querySelector('#title-pet-canvas') as HTMLElement;
    if (!container) return;

    const W = Math.min(container.clientWidth || 350, 390);
    const H = 160;

    const canvas = document.createElement('canvas');
    canvas.width = W * 2;
    canvas.height = H * 2;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    canvas.style.display = 'block';
    canvas.style.margin = '0 auto';
    container.appendChild(canvas);

    const c = canvas.getContext('2d');
    if (!c) return;
    c.scale(2, 2);

    const pets: TitlePet[] = [
      {
        type: 'dog', stage: 'child', anim: createAnimState(),
        x: W * 0.2, y: H * 0.55, size: 75,
      },
      {
        type: 'cat', stage: 'baby', anim: createAnimState(),
        x: W * 0.5, y: H * 0.5, size: 85,
      },
      {
        type: 'bird', stage: 'baby', anim: createAnimState(),
        x: W * 0.8, y: H * 0.55, size: 70,
      },
    ];

    // Set initial emotions
    pets[0].anim.emotion = 'happy';
    pets[1].anim.emotion = 'neutral';
    pets[2].anim.emotion = 'love';

    let lastTime = performance.now();
    let frameId = 0;

    const loop = (time: number): void => {
      const dt = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;

      for (const pet of pets) {
        updateAnimState(pet.anim, dt);
      }

      // Cycle emotions periodically
      const t = performance.now() / 1000;
      const emotions: Array<PetAnimState['emotion']> = ['happy', 'neutral', 'love'];
      for (let i = 0; i < pets.length; i++) {
        const cycle = Math.floor((t + i * 1.5) / 3) % 3;
        pets[i].anim.emotion = emotions[cycle];
      }

      c.clearRect(0, 0, W, H);

      for (const pet of pets) {
        drawPet(c, pet.type, pet.stage, pet.anim, pet.x, pet.y, pet.size);
      }

      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    this.cleanups.push(() => cancelAnimationFrame(frameId));
  }

  unmount(): void {
    this.cleanups.forEach(fn => fn());
    this.cleanups = [];
  }
}
