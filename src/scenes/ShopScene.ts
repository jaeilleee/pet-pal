/**
 * ShopScene -- 상점 (먹이/간식/액세서리/가구/펫 슬롯)
 */

import type { Scene } from './SceneManager';
import type { AppContext } from '../app/AppContext';
import type { PetPalState } from '../data/state';
import type { SceneManager } from './SceneManager';
import { ITEMS, type ItemCategory, type ItemDef } from '../data/items';
import { getActivePet, applyEffectsToPet, PET_SLOT_COSTS, MAX_PETS } from '../data/state';
import { showToast } from '../ui/Toast';

type Ctx = AppContext<PetPalState, SceneManager>;

type ShopTab = ItemCategory | 'slot';

const TABS: Array<{ category: ShopTab; label: string; emoji: string }> = [
  { category: 'food', label: '먹이', emoji: '🍖' },
  { category: 'snack', label: '간식', emoji: '🍪' },
  { category: 'accessory', label: '액세서리', emoji: '🎀' },
  { category: 'furniture', label: '가구', emoji: '🏠' },
  { category: 'slot', label: '펫 슬롯', emoji: '🐾' },
];

export class ShopScene implements Scene {
  private ctx: Ctx;
  private cleanups: Array<() => void> = [];
  private activeTab: ShopTab = 'food';

  constructor(ctx: Ctx) {
    this.ctx = ctx;
  }

  mount(root: HTMLElement): void {
    root.innerHTML = `
      <div class="scene shop-scene">
        <div class="scene-header">
          <button class="btn-back" id="btn-back">←</button>
          <h2>상점</h2>
          <div class="shop-gold">💰 <span id="shop-gold">${this.ctx.state.current.gold}</span>G</div>
        </div>
        <div class="shop-tabs" id="shop-tabs"></div>
        <div class="shop-items" id="shop-items"></div>
      </div>
    `;

    this.renderTabs(root);
    this.renderItems(root);

    const backBtn = root.querySelector('#btn-back') as HTMLElement;
    const backHandler = (): void => {
      this.ctx.sound.playClick();
      import('./HomeScene').then(m => {
        this.ctx.scenes.switchTo(() => new m.HomeScene(this.ctx));
      }).catch(err => console.error('[ShopScene] load failed', err));
    };
    backBtn.addEventListener('click', backHandler);
    this.cleanups.push(() => backBtn.removeEventListener('click', backHandler));
  }

  private renderTabs(root: HTMLElement): void {
    const tabsEl = root.querySelector('#shop-tabs') as HTMLElement;
    tabsEl.innerHTML = TABS.map(t => `
      <button class="shop-tab ${t.category === this.activeTab ? 'active' : ''}"
              data-cat="${t.category}">
        ${t.emoji} ${t.label}
      </button>
    `).join('');

    tabsEl.querySelectorAll('.shop-tab').forEach(btn => {
      const handler = (): void => {
        this.activeTab = (btn as HTMLElement).dataset.cat as ShopTab;
        this.ctx.sound.playClick();
        this.renderTabs(root);
        this.renderItems(root);
      };
      btn.addEventListener('click', handler);
      this.cleanups.push(() => btn.removeEventListener('click', handler));
    });
  }

  private renderItems(root: HTMLElement): void {
    if (this.activeTab === 'slot') {
      this.renderSlotItems(root);
      return;
    }

    const itemsEl = root.querySelector('#shop-items') as HTMLElement;
    const state = this.ctx.state.current;
    const activePet = getActivePet(state);
    const bond = activePet?.stats.bond ?? 0;
    const items = ITEMS.filter(i => i.category === this.activeTab);

    itemsEl.innerHTML = items.map(item => {
      const locked = item.unlockBond !== undefined && bond < item.unlockBond;
      const owned = this.isOwned(item);
      const canBuy = state.gold >= item.price && !locked;

      return `
        <div class="shop-item ${locked ? 'locked' : ''} ${owned ? 'owned' : ''}">
          <span class="shop-item-emoji">${locked ? '🔒' : item.emoji}</span>
          <div class="shop-item-info">
            <span class="shop-item-name">${locked ? '???' : item.name}</span>
            <span class="shop-item-desc">${locked ? `유대감 ${item.unlockBond} 필요` : item.description}</span>
            <div class="shop-item-effects">${this.renderEffects(item)}</div>
          </div>
          <button class="btn-buy ${canBuy ? '' : 'disabled'}" data-id="${item.id}"
                  ${locked || (!canBuy && !owned) ? 'disabled' : ''}>
            ${owned && (item.category === 'accessory' || item.category === 'furniture') ? '장착' : `${item.price}G`}
          </button>
        </div>
      `;
    }).join('');

    this.bindItemButtons(itemsEl, root);
  }

  private renderSlotItems(root: HTMLElement): void {
    const itemsEl = root.querySelector('#shop-items') as HTMLElement;
    const state = this.ctx.state.current;

    const slots = [];
    for (let i = 1; i < MAX_PETS; i++) {
      const slotNum = i + 1;
      const cost = PET_SLOT_COSTS[i];
      const unlocked = state.unlockedSlots > i;
      const canBuy = state.gold >= cost && !unlocked;

      slots.push(`
        <div class="shop-item ${unlocked ? 'owned' : ''}">
          <span class="shop-item-emoji">${unlocked ? '✅' : '🐾'}</span>
          <div class="shop-item-info">
            <span class="shop-item-name">펫 슬롯 ${slotNum}</span>
            <span class="shop-item-desc">${unlocked ? '해금됨' : `${slotNum}번째 펫을 키울 수 있어요`}</span>
          </div>
          <button class="btn-buy ${canBuy ? '' : 'disabled'}" data-slot="${i}"
                  ${unlocked || !canBuy ? 'disabled' : ''}>
            ${unlocked ? '해금됨' : `${cost}G`}
          </button>
        </div>
      `);
    }

    itemsEl.innerHTML = slots.join('');

    itemsEl.querySelectorAll('.btn-buy[data-slot]').forEach(btn => {
      const handler = (): void => {
        const slotIdx = parseInt((btn as HTMLElement).dataset.slot ?? '0', 10);
        this.buySlot(slotIdx, root);
      };
      btn.addEventListener('click', handler);
      this.cleanups.push(() => btn.removeEventListener('click', handler));
    });
  }

  private buySlot(slotIndex: number, root: HTMLElement): void {
    const state = this.ctx.state.current;
    const cost = PET_SLOT_COSTS[slotIndex];

    if (state.gold < cost) {
      showToast('골드가 부족해요!');
      this.ctx.sound.playError();
      return;
    }

    if (state.unlockedSlots > slotIndex) {
      showToast('이미 해금된 슬롯이에요!');
      return;
    }

    this.ctx.state.current = {
      ...state,
      gold: state.gold - cost,
      unlockedSlots: slotIndex + 1,
    };
    this.ctx.save.save(this.ctx.state.current);
    this.ctx.sound.playCoin();
    showToast(`펫 슬롯 ${slotIndex + 1} 해금!`);
    this.updateGold(root);
    this.renderItems(root);
  }

  private bindItemButtons(itemsEl: HTMLElement, root: HTMLElement): void {
    itemsEl.querySelectorAll('.btn-buy[data-id]').forEach(btn => {
      const handler = (): void => {
        const id = (btn as HTMLElement).dataset.id;
        if (!id) return;
        this.buyItem(id, root);
      };
      btn.addEventListener('click', handler);
      this.cleanups.push(() => btn.removeEventListener('click', handler));
    });
  }

  private isOwned(item: ItemDef): boolean {
    const state = this.ctx.state.current;
    if (item.category === 'accessory') return state.ownedItems.includes(item.id);
    if (item.category === 'furniture') return state.ownedFurniture.includes(item.id);
    return false;
  }

  private renderEffects(item: ItemDef): string {
    const labels: Record<string, string> = {
      hunger: '배고픔', happiness: '행복', cleanliness: '청결', energy: '기력', bond: '유대감',
    };
    return Object.entries(item.effects)
      .map(([k, v]) => `<span class="effect ${v > 0 ? 'positive' : 'negative'}">+${v} ${labels[k] ?? k}</span>`)
      .join('');
  }

  private buyItem(id: string, root: HTMLElement): void {
    const item = ITEMS.find(i => i.id === id);
    if (!item) return;

    const state = this.ctx.state.current;
    const activePet = getActivePet(state);

    // 이미 소유한 액세서리/가구: 장착
    if (this.isOwned(item)) {
      if (item.category === 'accessory' && activePet) {
        const isEquipped = activePet.equippedAccessory === id;
        const pets = [...state.pets];
        pets[state.activePetIndex] = { ...activePet, equippedAccessory: isEquipped ? null : id };
        this.ctx.state.current = { ...state, pets };
        showToast(!isEquipped ? `${item.name} 장착!` : '액세서리 해제');
      }
      this.ctx.save.save(this.ctx.state.current);
      this.ctx.sound.playClick();
      this.renderItems(root);
      return;
    }

    if (state.gold < item.price) {
      showToast('골드가 부족해요!');
      this.ctx.sound.playError();
      return;
    }

    const idx = state.activePetIndex;
    let updated: PetPalState = { ...state, gold: state.gold - item.price };

    if (item.category === 'food' || item.category === 'snack') {
      updated = applyEffectsToPet(updated, idx, item.effects);
      updated = { ...updated, totalFeeds: updated.totalFeeds + 1 };
      showToast(`${item.name} 사용! ${item.emoji}`);
      this.ctx.sound.playHarvest();
    } else if (item.category === 'accessory') {
      const pets = [...updated.pets];
      const pet = { ...pets[idx], equippedAccessory: id };
      pets[idx] = pet;
      updated = { ...updated, ownedItems: [...updated.ownedItems, id], pets };
      showToast(`${item.name} 획득 + 장착!`);
      this.ctx.sound.playCoin();
    } else if (item.category === 'furniture') {
      updated = { ...updated, ownedFurniture: [...updated.ownedFurniture, id] };
      updated = applyEffectsToPet(updated, idx, item.effects);
      showToast(`${item.name} 설치!`);
      this.ctx.sound.playCoin();
    }

    this.ctx.state.current = updated;
    this.ctx.save.save(this.ctx.state.current);
    this.updateGold(root);
    this.renderItems(root);
  }

  private updateGold(root: HTMLElement): void {
    const el = root.querySelector('#shop-gold');
    if (el) el.textContent = String(this.ctx.state.current.gold);
  }

  unmount(): void {
    this.cleanups.forEach(fn => fn());
    this.cleanups = [];
  }
}
