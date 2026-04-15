/**
 * TitleScene -- 타이틀 화면 (Canvas 펫 3마리 대형 렌더)
 */

import type { Scene } from './SceneManager';
import type { AppContext } from '../app/AppContext';
import type { PetPalState } from '../data/state';
import type { SceneManager } from './SceneManager';
import { createAnimState, updateAnimState, type PetAnimState } from '../game/PetRenderer';
import { drawPetSprite } from '../game/PetSprite';
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
        <div class="title-bokeh" id="title-bokeh"></div>
        <div class="title-bg">
          <div class="title-content">
            <div class="title-logo">
              <div id="title-pet-canvas" style="height:300px;margin-bottom:8px;"></div>
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

    // Bokeh circles
    this.setupBokeh(root);

    // Canvas 3마리 펫 렌더
    this.setupTitleCanvas(root);

    const btn = root.querySelector('#btn-start') as HTMLButtonElement;
    const handler = (): void => {
      this.ctx.sound.ensureContext();
      this.ctx.sound.playClick();

      const state = this.ctx.state.current;

      // 첫 실행 시 온보딩 스토리
      if (!state.tutorialShown && state.pets.length === 0) {
        this.showOnboardingStory(root);
        return;
      }

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

  private setupBokeh(root: HTMLElement): void {
    const container = root.querySelector('#title-bokeh') as HTMLElement;
    if (!container) return;

    const colors = ['#FFB74D', '#FF8A65', '#FFAB91', '#FFD54F', '#FFE082', '#F48FB1', '#CE93D8'];
    for (let i = 0; i < 12; i++) {
      const circle = document.createElement('div');
      circle.className = 'bokeh-circle';
      const size = 40 + Math.random() * 80;
      circle.style.cssText = `
        width: ${size}px; height: ${size}px;
        left: ${Math.random() * 100}%;
        top: ${Math.random() * 100}%;
        --bokeh-color: ${colors[i % colors.length]};
        --duration: ${4 + Math.random() * 4}s;
        --delay: ${Math.random() * -6}s;
      `;
      container.appendChild(circle);
    }
  }

  private setupTitleCanvas(root: HTMLElement): void {
    const container = root.querySelector('#title-pet-canvas') as HTMLElement;
    if (!container) return;

    const W = Math.min(container.clientWidth || 380, 400);
    const H = 300;

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

    // Main dog (large center), cat left smaller, bird right smaller
    const pets: TitlePet[] = [
      {
        type: 'cat', stage: 'baby', anim: createAnimState(),
        x: W * 0.18, y: H * 0.55, size: 80,
      },
      {
        type: 'dog', stage: 'child', anim: createAnimState(),
        x: W * 0.5, y: H * 0.45, size: 130,
      },
      {
        type: 'bird', stage: 'baby', anim: createAnimState(),
        x: W * 0.82, y: H * 0.55, size: 75,
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
        drawPetSprite(c, pet.type, pet.stage, pet.x, pet.y, pet.size, {
          bounceY: pet.anim.bounceY,
          scale: pet.anim.breathScale,
        });
      }

      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    this.cleanups.push(() => cancelAnimationFrame(frameId));
  }

  /** 온보딩 3컷 스토리 */
  private showOnboardingStory(root: HTMLElement): void {
    const cuts = [
      { text: '어느 날, 길에서 작은 소리가 들렸어요...', emoji: '', bg: '🌙' },
      { text: '살펴보니 작은 동물이 떨고 있었어요...', emoji: '🥺', bg: '🌿' },
      { text: '데려가서 돌봐줄 거예요? 💕', emoji: '💕', bg: '🏠' },
    ];

    let currentCut = 0;

    const overlay = document.createElement('div');
    overlay.className = 'onboarding-overlay';

    const renderCut = (): void => {
      const cut = cuts[currentCut];
      const isLast = currentCut === cuts.length - 1;
      const emojiShake = currentCut === 1 ? ' onboarding-shake' : '';

      overlay.innerHTML = `
        <div class="onboarding-scene">
          <div class="onboarding-bg">${cut.bg}</div>
          <div class="onboarding-emoji${emojiShake}">${cut.emoji}</div>
          <p class="onboarding-text">${cut.text}</p>
          <div class="onboarding-dots">
            ${cuts.map((_, i) => `<span class="dot ${i === currentCut ? 'active' : ''}"></span>`).join('')}
          </div>
          ${isLast
            ? '<button class="btn-primary onboarding-yes" id="btn-onboarding-yes">네!</button>'
            : '<p class="onboarding-tap">탭하여 계속</p>'
          }
        </div>
      `;

      if (isLast) {
        const yesBtn = overlay.querySelector('#btn-onboarding-yes') as HTMLElement;
        yesBtn.addEventListener('click', () => {
          this.ctx.sound.playClick();
          this.ctx.state.current = { ...this.ctx.state.current, tutorialShown: true };
          this.ctx.save.save(this.ctx.state.current);
          overlay.remove();
          import('./PetSelectScene').then(m => {
            this.ctx.scenes.switchTo(() => new m.PetSelectScene(this.ctx));
          }).catch(err => console.error('[TitleScene] PetSelect load failed', err));
        });
      }
    };

    overlay.addEventListener('click', (e) => {
      // "네!" 버튼 클릭은 별도 처리
      if ((e.target as HTMLElement).closest('#btn-onboarding-yes')) return;

      if (currentCut < cuts.length - 1) {
        currentCut++;
        this.ctx.sound.playClick();
        renderCut();
      }
    });

    renderCut();
    root.appendChild(overlay);
  }

  unmount(): void {
    this.cleanups.forEach(fn => fn());
    this.cleanups = [];
  }
}
