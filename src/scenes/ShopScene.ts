/**
 * ShopScene -- 상점 (먹이/간식/액세서리/가구/펫 슬롯)
 */

import type { Scene } from './SceneManager';
import type { AppContext } from '../app/AppContext';
import type { PetPalState } from '../data/state';
import type { SceneManager } from './SceneManager';
import { ITEMS, type ItemCategory, type ItemDef } from '../data/items';
import { getActivePet, applyEffectsToPet, PET_SLOT_COSTS, MAX_PETS } from '../data/state';
import { rollGacha, GACHA_COST, RARITY_COLORS, RARITY_LABELS, type GachaItem } from '../data/gacha';
import { showToast } from '../ui/Toast';

type Ctx = AppContext<PetPalState, SceneManager>;

type ShopTab = ItemCategory | 'slot' | 'gacha';

const TABS: Array<{ category: ShopTab; label: string; emoji: string }> = [
  { category: 'food', label: '먹이', emoji: '🍖' },
  { category: 'snack', label: '간식', emoji: '🍪' },
  { category: 'gacha', label: '뽑기', emoji: '🎁' },
  { category: 'accessory', label: '액세서리', emoji: '🎀' },
  { category: 'furniture', label: '가구', emoji: '🏠' },
  { category: 'room-theme', label: '테마', emoji: '🎨' },
  { category: 'color', label: '색상', emoji: '🎨' },
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
    if (this.activeTab === 'gacha') {
      this.renderGachaTab(root);
      return;
    }

    const itemsEl = root.querySelector('#shop-items') as HTMLElement;
    const state = this.ctx.state.current;
    const activePet = getActivePet(state);
    const bond = activePet?.stats.bond ?? 0;
    let items = ITEMS.filter(i => i.category === this.activeTab);

    // 색상 탭: 현재 펫 타입에 맞는 아이템만 표시
    if (this.activeTab === 'color' && activePet) {
      items = items.filter(i => i.targetPetType === activePet.type);
    }

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
            ${owned && (item.category === 'accessory' || item.category === 'furniture' || item.category === 'room-theme' || item.category === 'color') ? (item.category === 'room-theme' ? (state.activeRoomTheme === item.id ? '해제' : '적용') : item.category === 'color' ? (activePet?.colorVariant === item.colorVariantId ? '해제' : '적용') : '장착') : `${item.price}G`}
          </button>
        </div>
      `;
    }).join('');

    this.bindItemButtons(itemsEl, root);
  }

  private renderGachaTab(root: HTMLElement): void {
    const itemsEl = root.querySelector('#shop-items') as HTMLElement;
    const state = this.ctx.state.current;
    const canPull = state.gold >= GACHA_COST;

    itemsEl.innerHTML = `
      <div class="gacha-container">
        <div class="gacha-machine">
          <div class="gacha-ball">🎁</div>
          <p class="gacha-desc">럭키 뽑기! 1회 ${GACHA_COST}G</p>
          <p class="gacha-rates">일반 60% | 레어 25% | 에픽 12% | 전설 3%</p>
          <button class="btn-gacha ${canPull ? '' : 'disabled'}" id="btn-gacha" ${canPull ? '' : 'disabled'}>
            🎰 뽑기! (${GACHA_COST}G)
          </button>
        </div>
        <div id="gacha-result" class="gacha-result" style="display:none"></div>
      </div>
    `;

    const gachaBtn = itemsEl.querySelector('#btn-gacha');
    if (gachaBtn) {
      const handler = (): void => this.executeGacha(root);
      gachaBtn.addEventListener('click', handler);
      this.cleanups.push(() => gachaBtn.removeEventListener('click', handler));
    }
  }

  private executeGacha(root: HTMLElement): void {
    const state = this.ctx.state.current;
    if (state.gold < GACHA_COST) {
      showToast('골드가 부족해요!');
      this.ctx.sound.playError();
      return;
    }

    // 비용 차감
    this.ctx.state.current = { ...state, gold: state.gold - GACHA_COST };

    // 뽑기 실행
    const item = rollGacha();
    this.ctx.sound.playClick();

    // 결과 처리
    this.applyGachaResult(item);

    // 연출
    const resultEl = root.querySelector('#gacha-result') as HTMLElement;
    const ballEl = root.querySelector('.gacha-ball') as HTMLElement;
    if (ballEl) {
      ballEl.classList.add('gacha-spinning');
      setTimeout(() => ballEl.classList.remove('gacha-spinning'), 600);
    }

    setTimeout(() => {
      if (!resultEl) return;
      const rarityColor = RARITY_COLORS[item.rarity];
      const rarityLabel = RARITY_LABELS[item.rarity];
      resultEl.style.display = 'block';
      resultEl.innerHTML = `
        <div class="gacha-reward" style="border-color:${rarityColor}">
          <span class="gacha-reward-rarity" style="color:${rarityColor}">${rarityLabel}</span>
          <span class="gacha-reward-emoji">${item.emoji}</span>
          <span class="gacha-reward-name">${item.name}</span>
        </div>
      `;
      if (item.rarity === 'legendary') {
        showToast('🎉 전설 등급! 대박이에요!');
      } else if (item.rarity === 'epic') {
        showToast('✨ 에픽 등급!');
      }
      this.ctx.sound.playCoin();
      this.updateGold(root);
      // 다시 뽑기 버튼 갱신
      const gachaBtn = root.querySelector('#btn-gacha') as HTMLButtonElement;
      if (gachaBtn) {
        const canPull = this.ctx.state.current.gold >= GACHA_COST;
        gachaBtn.disabled = !canPull;
        if (!canPull) gachaBtn.classList.add('disabled');
      }
    }, 600);
  }

  private applyGachaResult(item: GachaItem): void {
    const state = this.ctx.state.current;
    if (item.type === 'gold' && item.value) {
      this.ctx.state.current = {
        ...state,
        gold: state.gold + item.value,
        totalGoldEarned: state.totalGoldEarned + item.value,
        gachaHistory: [...state.gachaHistory, item.id].slice(-50),
      };
    } else if (item.type === 'accessory') {
      const ownedItems = state.ownedItems.includes(item.id)
        ? state.ownedItems
        : [...state.ownedItems, item.id];
      this.ctx.state.current = {
        ...state,
        ownedItems,
        gachaHistory: [...state.gachaHistory, item.id].slice(-50),
      };
    } else {
      this.ctx.state.current = {
        ...state,
        gachaHistory: [...state.gachaHistory, item.id].slice(-50),
      };
    }
    this.ctx.save.save(this.ctx.state.current);
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
    if (item.category === 'room-theme') return state.ownedItems.includes(item.id);
    if (item.category === 'color') return state.ownedItems.includes(item.id);
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

    // 이미 소유한 액세서리/가구/테마/색상: 장착/적용
    if (this.isOwned(item)) {
      if (item.category === 'accessory' && activePet) {
        const isEquipped = activePet.equippedAccessory === id;
        const pets = [...state.pets];
        pets[state.activePetIndex] = { ...activePet, equippedAccessory: isEquipped ? null : id };
        this.ctx.state.current = { ...state, pets };
        showToast(!isEquipped ? `${item.name} 장착!` : '액세서리 해제');
      } else if (item.category === 'room-theme') {
        const isActive = state.activeRoomTheme === id;
        this.ctx.state.current = { ...state, activeRoomTheme: isActive ? null : id };
        showToast(!isActive ? `${item.emoji} ${item.name} 테마 적용!` : '기본 테마로 돌아갑니다');
      } else if (item.category === 'color' && activePet && item.colorVariantId) {
        const isActive = activePet.colorVariant === item.colorVariantId;
        const pets = [...state.pets];
        pets[state.activePetIndex] = { ...activePet, colorVariant: isActive ? 'default' : item.colorVariantId };
        this.ctx.state.current = { ...state, pets };
        showToast(!isActive ? `${item.emoji} ${item.name} 색상 적용!` : '기본 색상으로 돌아갑니다');
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
    } else if (item.category === 'room-theme') {
      updated = { ...updated, ownedItems: [...updated.ownedItems, id], activeRoomTheme: id };
      updated = applyEffectsToPet(updated, idx, item.effects);
      showToast(`${item.emoji} ${item.name} 테마 적용!`);
      this.ctx.sound.playCoin();
    } else if (item.category === 'color' && item.colorVariantId) {
      const pets = [...updated.pets];
      pets[idx] = { ...pets[idx], colorVariant: item.colorVariantId };
      updated = { ...updated, ownedItems: [...updated.ownedItems, id], pets };
      updated = applyEffectsToPet(updated, idx, item.effects);
      showToast(`${item.emoji} ${item.name} 색상 적용!`);
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
