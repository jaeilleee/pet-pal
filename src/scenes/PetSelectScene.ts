/**
 * PetSelectScene -- 반려동물 선택
 */

import type { Scene } from './SceneManager';
import type { AppContext } from '../app/AppContext';
import type { PetPalState } from '../data/state';
import type { SceneManager } from './SceneManager';
import { PETS, PET_TYPES, type PetType } from '../data/pets';

type Ctx = AppContext<PetPalState, SceneManager>;

export class PetSelectScene implements Scene {
  private ctx: Ctx;
  private cleanups: Array<() => void> = [];
  private selected: PetType | null = null;

  constructor(ctx: Ctx) {
    this.ctx = ctx;
  }

  mount(root: HTMLElement): void {
    root.innerHTML = `
      <div class="scene pet-select-scene">
        <div class="scene-header">
          <h2>반려동물을 선택해주세요</h2>
          <p class="scene-sub">함께할 친구를 골라보세요!</p>
        </div>
        <div class="pet-grid" id="pet-grid"></div>
        <div class="pet-detail" id="pet-detail" style="display:none">
          <div class="pet-detail-emoji" id="detail-emoji"></div>
          <h3 id="detail-name"></h3>
          <p id="detail-desc"></p>
          <p class="pet-trait" id="detail-trait"></p>
          <div class="name-input-wrap">
            <label>이름을 지어주세요</label>
            <input type="text" id="pet-name-input" placeholder="이름 입력..." maxlength="10" />
          </div>
          <button class="btn-primary" id="btn-confirm" disabled>이 친구로 결정!</button>
        </div>
      </div>
    `;

    const grid = root.querySelector('#pet-grid') as HTMLElement;
    const detail = root.querySelector('#pet-detail') as HTMLElement;

    for (const type of PET_TYPES) {
      const pet = PETS[type];
      const card = document.createElement('button');
      card.className = 'pet-card';
      card.dataset.type = type;
      card.innerHTML = `
        <span class="pet-card-emoji">${pet.stages.baby.emoji}</span>
        <span class="pet-card-name">${pet.name}</span>
      `;
      card.style.setProperty('--pet-bg', pet.bgColor);
      grid.appendChild(card);

      const handler = (): void => {
        this.ctx.sound.playClick();
        this.selected = type;
        grid.querySelectorAll('.pet-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.showDetail(detail, type);
      };
      card.addEventListener('click', handler);
      this.cleanups.push(() => card.removeEventListener('click', handler));
    }

    // name input
    const nameInput = root.querySelector('#pet-name-input') as HTMLInputElement;
    const confirmBtn = root.querySelector('#btn-confirm') as HTMLButtonElement;
    const inputHandler = (): void => {
      confirmBtn.disabled = nameInput.value.trim().length === 0;
    };
    nameInput.addEventListener('input', inputHandler);
    this.cleanups.push(() => nameInput.removeEventListener('input', inputHandler));

    // confirm
    const confirmHandler = (): void => {
      if (!this.selected || !nameInput.value.trim()) return;
      this.ctx.sound.playLevelUp();

      const state = this.ctx.state.current;
      state.petType = this.selected;
      state.petName = nameInput.value.trim();
      this.ctx.save.save(state);

      import('./HomeScene').then(m => {
        this.ctx.scenes.switchTo(() => new m.HomeScene(this.ctx));
      });
    };
    confirmBtn.addEventListener('click', confirmHandler);
    this.cleanups.push(() => confirmBtn.removeEventListener('click', confirmHandler));
  }

  private showDetail(detail: HTMLElement, type: PetType): void {
    const pet = PETS[type];
    detail.style.display = 'block';
    (detail.querySelector('#detail-emoji') as HTMLElement).textContent = pet.stages.baby.emoji;
    (detail.querySelector('#detail-name') as HTMLElement).textContent = pet.name;
    (detail.querySelector('#detail-desc') as HTMLElement).textContent = pet.description;
    (detail.querySelector('#detail-trait') as HTMLElement).textContent = `✨ ${pet.trait}`;
  }

  unmount(): void {
    this.cleanups.forEach(fn => fn());
    this.cleanups = [];
  }
}
