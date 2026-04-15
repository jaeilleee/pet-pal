/**
 * PetSelectScene -- 반려동물 선택 (첫 선택 + 추가 모드)
 */

import type { Scene } from './SceneManager';
import type { AppContext } from '../app/AppContext';
import type { PetPalState } from '../data/state';
import type { SceneManager } from './SceneManager';
import { PETS, PET_TYPES, type PetType } from '../data/pets';
import { createPetData } from '../data/state';
import { showToast } from '../ui/Toast';

type Ctx = AppContext<PetPalState, SceneManager>;

/** 'first' = 첫 펫 선택, 'add' = 추가 펫 */
export type SelectMode = 'first' | 'add';

export class PetSelectScene implements Scene {
  private ctx: Ctx;
  private mode: SelectMode;
  private cleanups: Array<() => void> = [];
  private selected: PetType | null = null;

  constructor(ctx: Ctx, mode: SelectMode = 'first') {
    this.ctx = ctx;
    this.mode = mode;
  }

  mount(root: HTMLElement): void {
    const state = this.ctx.state.current;

    // 슬롯 체크 (추가 모드)
    if (this.mode === 'add' && state.pets.length >= state.unlockedSlots) {
      showToast('슬롯 해금이 필요해요! 상점에서 구매하세요');
      import('./HomeScene').then(m => {
        this.ctx.scenes.switchTo(() => new m.HomeScene(this.ctx));
      }).catch(err => console.error('[PetSelectScene] load failed', err));
      return;
    }

    const title = this.mode === 'add' ? '새 친구를 골라주세요' : '반려동물을 선택해주세요';
    const subtitle = this.mode === 'add'
      ? `슬롯 ${state.pets.length + 1}/${state.unlockedSlots}`
      : '함께할 친구를 골라보세요!';

    root.innerHTML = `
      <div class="scene pet-select-scene">
        <div class="scene-header">
          ${this.mode === 'add' ? '<button class="btn-back" id="btn-back">←</button>' : ''}
          <h2>${title}</h2>
          <p class="scene-sub">${subtitle}</p>
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

    // 뒤로가기 (추가 모드)
    if (this.mode === 'add') {
      const backBtn = root.querySelector('#btn-back');
      if (backBtn) {
        const handler = (): void => {
          this.ctx.sound.playClick();
          import('./HomeScene').then(m => {
            this.ctx.scenes.switchTo(() => new m.HomeScene(this.ctx));
          }).catch(err => console.error('[PetSelectScene] load failed', err));
        };
        backBtn.addEventListener('click', handler);
        this.cleanups.push(() => backBtn.removeEventListener('click', handler));
      }
    }

    this.buildPetGrid(root);
    this.bindNameInput(root);
    this.bindConfirm(root);
  }

  private buildPetGrid(root: HTMLElement): void {
    const grid = root.querySelector('#pet-grid') as HTMLElement;
    const detail = root.querySelector('#pet-detail') as HTMLElement;

    // 이미 소유한 타입 필터 (추가 모드에서 중복 방지)
    const ownedTypes = new Set(this.ctx.state.current.pets.map(p => p.type));

    for (const type of PET_TYPES) {
      const pet = PETS[type];
      const isOwned = this.mode === 'add' && ownedTypes.has(type);
      const card = document.createElement('button');
      card.className = `pet-card ${isOwned ? 'disabled' : ''}`;
      card.dataset.type = type;
      card.disabled = isOwned;
      card.innerHTML = `
        <img class="pet-card-emoji" src="/assets/pets/${type}-baby.png" width="140" height="140" style="object-fit:contain" alt="${pet.name}">
        <span class="pet-card-name">${pet.name}</span>
        ${isOwned ? '<span class="pet-card-owned">보유중</span>' : ''}
      `;
      card.style.setProperty('--pet-bg', pet.bgColor);
      grid.appendChild(card);

      if (!isOwned) {
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
    }
  }

  private bindNameInput(root: HTMLElement): void {
    const nameInput = root.querySelector('#pet-name-input') as HTMLInputElement;
    const confirmBtn = root.querySelector('#btn-confirm') as HTMLButtonElement;
    const handler = (): void => {
      confirmBtn.disabled = nameInput.value.trim().length === 0;
    };
    nameInput.addEventListener('input', handler);
    this.cleanups.push(() => nameInput.removeEventListener('input', handler));
  }

  private bindConfirm(root: HTMLElement): void {
    const nameInput = root.querySelector('#pet-name-input') as HTMLInputElement;
    const confirmBtn = root.querySelector('#btn-confirm') as HTMLButtonElement;

    const handler = (): void => {
      if (!this.selected || !nameInput.value.trim()) return;
      this.ctx.sound.playLevelUp();

      const state = this.ctx.state.current;
      const newId = state.pets.length > 0
        ? Math.max(...state.pets.map(p => p.id)) + 1
        : 1;
      const newPet = createPetData(this.selected, nameInput.value.trim(), newId);
      const newPets = [...state.pets, newPet];

      if (this.mode === 'first') {
        this.ctx.state.current = {
          ...state,
          pets: newPets,
          petType: this.selected,
          petName: nameInput.value.trim(),
        };
      } else {
        this.ctx.state.current = {
          ...state,
          pets: newPets,
          activePetIndex: newPets.length - 1,
        };
      }

      this.ctx.save.save(this.ctx.state.current);
      showToast(`${newPet.name}이(가) 가족이 됐어요!`);

      import('./HomeScene').then(m => {
        this.ctx.scenes.switchTo(() => new m.HomeScene(this.ctx));
      }).catch(err => console.error('[PetSelectScene] load failed', err));
    };
    confirmBtn.addEventListener('click', handler);
    this.cleanups.push(() => confirmBtn.removeEventListener('click', handler));
  }

  private showDetail(detail: HTMLElement, type: PetType): void {
    const pet = PETS[type];
    detail.style.display = 'block';
    const emojiEl = detail.querySelector('#detail-emoji') as HTMLElement;
    emojiEl.innerHTML = `<img src="/assets/pets/${type}-baby.png" width="160" height="160" style="object-fit:contain" alt="${pet.name}">`;
    (detail.querySelector('#detail-name') as HTMLElement).textContent = pet.name;
    (detail.querySelector('#detail-desc') as HTMLElement).textContent = pet.description;
    (detail.querySelector('#detail-trait') as HTMLElement).textContent = `${pet.trait}`;
  }

  unmount(): void {
    this.cleanups.forEach(fn => fn());
    this.cleanups = [];
  }
}
