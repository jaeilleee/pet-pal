/**
 * VisitorBookScene -- 방문자 도감 UI
 */

import type { Scene } from './SceneManager';
import type { AppContext } from '../app/AppContext';
import type { PetPalState } from '../data/state';
import type { SceneManager } from './SceneManager';
import { VISITORS, SEASONAL_VISITORS, type Visitor } from '../data/visitors';

type Ctx = AppContext<PetPalState, SceneManager>;

export class VisitorBookScene implements Scene {
  private ctx: Ctx;
  private cleanups: Array<() => void> = [];

  constructor(ctx: Ctx) {
    this.ctx = ctx;
  }

  mount(root: HTMLElement): void {
    const state = this.ctx.state.current;
    const allVisitors: Visitor[] = [...VISITORS, ...SEASONAL_VISITORS];
    const metCount = allVisitors.filter(v => state.visitorLog.includes(v.id)).length;
    const totalCount = allVisitors.length;

    root.innerHTML = `
      <div class="scene visitor-book-scene">
        <div class="scene-header">
          <button class="btn-back" id="btn-back">←</button>
          <h2>📖 방문자 도감</h2>
        </div>
        <div class="visitor-book-progress">
          <span class="visitor-progress-text">${metCount}/${totalCount} 수집!</span>
          <div class="visitor-progress-bar">
            <div class="visitor-progress-fill" style="width:${totalCount > 0 ? Math.round((metCount / totalCount) * 100) : 0}%"></div>
          </div>
        </div>
        <div class="visitor-book-list">
          ${this.renderVisitorList(allVisitors, state.visitorLog)}
        </div>
      </div>
    `;

    this.bindBack(root);
  }

  private renderVisitorList(visitors: Visitor[], log: string[]): string {
    return visitors.map(v => {
      const met = log.includes(v.id);
      const rarityClass = v.rarity === 'legendary' ? 'legendary'
        : v.rarity === 'rare' ? 'rare' : 'common';

      if (met) {
        return `
          <div class="visitor-card ${rarityClass}">
            <span class="visitor-card-emoji">${v.emoji}</span>
            <div class="visitor-card-info">
              <span class="visitor-card-name">${v.name}</span>
              <span class="visitor-card-gift">선물: ${v.gift.gold}G</span>
              <span class="visitor-card-msg">${v.message}</span>
            </div>
            <span class="visitor-card-rarity">${this.rarityLabel(v.rarity)}</span>
          </div>
        `;
      }
      return `
        <div class="visitor-card unknown">
          <span class="visitor-card-emoji">❓</span>
          <div class="visitor-card-info">
            <span class="visitor-card-name">???</span>
            <span class="visitor-card-gift">???</span>
          </div>
          <span class="visitor-card-rarity">${this.rarityLabel(v.rarity)}</span>
        </div>
      `;
    }).join('');
  }

  private rarityLabel(rarity: string): string {
    switch (rarity) {
      case 'legendary': return '✨전설';
      case 'rare': return '⭐희귀';
      default: return '일반';
    }
  }

  private bindBack(root: HTMLElement): void {
    const backBtn = root.querySelector('#btn-back') as HTMLElement;
    const handler = (): void => {
      this.ctx.sound.playClick();
      import('./ProfileScene').then(m => {
        this.ctx.scenes.switchTo(() => new m.ProfileScene(this.ctx));
      }).catch(err => console.error('[VisitorBookScene] load failed', err));
    };
    backBtn.addEventListener('click', handler);
    this.cleanups.push(() => backBtn.removeEventListener('click', handler));
  }

  unmount(): void {
    this.cleanups.forEach(fn => fn());
    this.cleanups = [];
  }
}
