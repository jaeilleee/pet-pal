/**
 * AchievementsScene -- 업적 목록 화면
 */

import type { Scene } from './SceneManager';
import type { AppContext } from '../app/AppContext';
import type { PetPalState } from '../data/state';
import type { SceneManager } from './SceneManager';
import { ACHIEVEMENTS } from '../data/achievements';

type Ctx = AppContext<PetPalState, SceneManager>;

export class AchievementsScene implements Scene {
  private ctx: Ctx;
  private cleanups: Array<() => void> = [];

  constructor(ctx: Ctx) {
    this.ctx = ctx;
  }

  mount(root: HTMLElement): void {
    const state = this.ctx.state.current;
    const unlocked = ACHIEVEMENTS.filter(a => state.achievements[a.id]);
    const locked = ACHIEVEMENTS.filter(a => !state.achievements[a.id]);

    root.innerHTML = `
      <div class="scene profile-scene">
        <div class="scene-header">
          <button class="btn-back" id="btn-back">←</button>
          <h2>🏆 업적 (${unlocked.length}/${ACHIEVEMENTS.length})</h2>
        </div>

        <div class="ach-list">
          ${unlocked.map(a => `
            <div class="ach-item unlocked">
              <span class="ach-emoji">${a.emoji}</span>
              <div class="ach-info">
                <span class="ach-name">${a.name}</span>
                <span class="ach-desc">${a.description}</span>
              </div>
              <span class="ach-reward">+${a.reward}G ✅</span>
            </div>
          `).join('')}

          ${locked.map(a => `
            <div class="ach-item locked">
              <span class="ach-emoji">🔒</span>
              <div class="ach-info">
                <span class="ach-name">${a.name}</span>
                <span class="ach-desc">${a.description}</span>
              </div>
              <span class="ach-reward">${a.reward}G</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    const backBtn = root.querySelector('#btn-back') as HTMLElement;
    const handler = (): void => {
      this.ctx.sound.playClick();
      import('./HomeScene').then(m => {
        this.ctx.scenes.switchTo(() => new m.HomeScene(this.ctx));
      });
    };
    backBtn.addEventListener('click', handler);
    this.cleanups.push(() => backBtn.removeEventListener('click', handler));
  }

  unmount(): void {
    this.cleanups.forEach(fn => fn());
    this.cleanups = [];
  }
}
