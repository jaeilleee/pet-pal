/**
 * TitleScene -- 타이틀 화면
 */

import type { Scene } from './SceneManager';
import type { AppContext } from '../app/AppContext';
import type { PetPalState } from '../data/state';
import type { SceneManager } from './SceneManager';
import { COLORS } from '../data/design-tokens';

type Ctx = AppContext<PetPalState, SceneManager>;

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
          <div class="title-floating-pets">
            <span class="float-pet" style="--delay:0s;--x:20%">🐶</span>
            <span class="float-pet" style="--delay:0.5s;--x:50%">🐱</span>
            <span class="float-pet" style="--delay:1s;--x:80%">🐦</span>
            <span class="float-pet" style="--delay:1.5s;--x:35%">🐷</span>
            <span class="float-pet" style="--delay:2s;--x:65%">🦎</span>
          </div>
          <div class="title-content">
            <div class="title-logo">
              <span class="title-paw">🐾</span>
              <h1 class="title-text">PetPal</h1>
              <p class="title-sub">나만의 반려동물 키우기</p>
            </div>
            <button class="btn-primary title-start-btn" id="btn-start">
              시작하기
            </button>
            <p class="title-version">v1.0.0</p>
          </div>
        </div>
      </div>
    `;

    const btn = root.querySelector('#btn-start') as HTMLButtonElement;
    const handler = (): void => {
      this.ctx.sound.ensureContext();
      this.ctx.sound.playClick();

      const state = this.ctx.state.current;
      if (state.petType) {
        // 이미 펫 선택됨 → 홈
        import('./HomeScene').then(m => {
          this.ctx.scenes.switchTo(() => new m.HomeScene(this.ctx));
        });
      } else {
        // 펫 선택 화면
        import('./PetSelectScene').then(m => {
          this.ctx.scenes.switchTo(() => new m.PetSelectScene(this.ctx));
        });
      }
    };
    btn.addEventListener('click', handler);
    this.cleanups.push(() => btn.removeEventListener('click', handler));
  }

  unmount(): void {
    this.cleanups.forEach(fn => fn());
    this.cleanups = [];
  }
}
