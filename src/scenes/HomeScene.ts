/**
 * HomeScene -- 메인 홈 화면 (멀티펫 Canvas + 돌봄 액션)
 */

import type { Scene } from './SceneManager';
import type { AppContext } from '../app/AppContext';
import type { PetPalState, PetStats, PetData } from '../data/state';
import type { SceneManager } from './SceneManager';
import { PETS, getGrowthStage } from '../data/pets';
import {
  getActivePet, getActiveStats, applyEffectsToPet,
  decayAllPets, overallMood, moodEmoji,
} from '../data/state';
import { getItemById } from '../data/items';
import { processLogin, updateDailyProgress, allDailyTasksDone, getDailyRewardTotal } from '../data/daily';
import { getTimeOfDay, getTimeBackground } from '../data/time-guard';
import { COLORS } from '../data/design-tokens';
import { showToast } from '../ui/Toast';
import { PetCanvas } from '../game/PetCanvas';
import { checkNewAchievements, claimAchievements } from '../data/achievements';

type Ctx = AppContext<PetPalState, SceneManager>;

/** 액션 쿨다운 (ms) */
const COOLDOWNS: Record<string, number> = {
  feed: 30_000, play: 45_000, walk: 60_000, clean: 40_000, talk: 15_000,
};

/** 대화 응답 (스탯 연동) */
function getPetSpeech(stats: PetStats): string {
  if (stats.hunger < 30) return '배고파... 밥 줘!';
  if (stats.happiness < 30) return '심심해... 놀아줘!';
  if (stats.cleanliness < 30) return '씻고 싶어...';
  if (stats.energy < 25) return '졸려...';
  const happy = ['좋아!', '고마워!', '사랑해!', '오늘 기분 좋아!', '산책 가고 싶어!', '같이 놀자!', '간식 먹고 싶어~'];
  return happy[Math.floor(Math.random() * happy.length)];
}

export class HomeScene implements Scene {
  private ctx: Ctx;
  private cleanups: Array<() => void> = [];
  private petCanvas: PetCanvas | null = null;
  private lastActionTime: Record<string, number> = {};

  constructor(ctx: Ctx) {
    this.ctx = ctx;
  }

  mount(root: HTMLElement): void {
    this.processLoginRewards();

    // 스탯 감소 + 업적 체크
    this.ctx.state.current = decayAllPets(this.ctx.state.current);
    this.checkAchievements();
    this.ctx.save.save(this.ctx.state.current);

    const state = this.ctx.state.current;
    const activePet = getActivePet(state);

    if (!activePet) {
      // 펫 없음 -> 선택 화면
      import('./PetSelectScene').then(m => {
        this.ctx.scenes.switchTo(() => new m.PetSelectScene(this.ctx));
      }).catch(err => console.error('[HomeScene] PetSelect load failed', err));
      return;
    }

    const stage = getGrowthStage(activePet.type, activePet.stats.bond);
    const stageInfo = PETS[activePet.type].stages[stage];
    const isSleeping = getTimeOfDay() === 'night' && activePet.stats.energy < 30;

    root.innerHTML = `
      <div class="scene home-scene" style="background:${getTimeBackground()}">
        <div class="home-header">
          <div class="home-gold"><span class="gold-icon">💰</span><span id="gold-amount">${state.gold}</span>G</div>
          <div class="pet-tabs" id="pet-tabs">${this.renderPetTabs(state)}</div>
          <div class="home-mood" id="mood-display">${moodEmoji(activePet.stats)}</div>
          <button class="btn-icon" id="btn-achievements">🏆</button>
        </div>

        <div class="home-pet-area" id="pet-container"></div>

        <div class="pet-name-display">
          <span class="pet-name-label" id="pet-name-label">${activePet.name}</span>
          <span class="pet-stage-label" id="pet-stage-label">${stageInfo.name}</span>
        </div>

        <div id="jealousy-alert" class="jealousy-alert" style="display:none"></div>

        <div class="stat-bars" id="stat-bars">${this.renderStatBars(activePet.stats)}</div>

        <div class="bond-bar">
          <div class="bond-label" id="bond-label">유대감 ${activePet.stats.bond} / ${this.getNextThreshold(activePet)}</div>
          <div class="bond-track"><div class="bond-fill" id="bond-fill" style="width:${this.getBondPercent(activePet)}%"></div></div>
        </div>

        <div class="action-grid">
          <button class="action-btn" data-action="feed"><span>🍖</span>먹이</button>
          <button class="action-btn" data-action="play"><span>🎾</span>놀기</button>
          <button class="action-btn" data-action="walk"><span>🚶</span>산책</button>
          <button class="action-btn" data-action="clean"><span>🛁</span>씻기</button>
          <button class="action-btn" data-action="talk"><span>💬</span>대화</button>
          <button class="action-btn" data-action="shop"><span>🛍️</span>상점</button>
          <button class="action-btn" data-action="minigame"><span>🎮</span>게임</button>
          <button class="action-btn" data-action="profile"><span>📋</span>프로필</button>
        </div>

        <div class="daily-strip" id="daily-strip">${this.renderDailyStrip(state)}</div>
      </div>
    `;

    // Canvas 멀티펫 렌더러
    const container = root.querySelector('#pet-container') as HTMLElement;
    this.petCanvas = new PetCanvas(container);
    this.petCanvas.setPets(state.pets);
    this.petCanvas.setActivePet(state.activePetIndex);
    if (isSleeping) this.petCanvas.setEmotion('sleeping');
    this.petCanvas.setFurniture(state.ownedFurniture.map(id => getItemById(id)?.emoji ?? ''));
    if (activePet.equippedAccessory) {
      this.petCanvas.setAccessory(getItemById(activePet.equippedAccessory)?.emoji ?? null);
    }
    this.petCanvas.setStats(activePet.stats);
    this.petCanvas.start();
    this.cleanups.push(() => this.petCanvas?.stop());

    this.bindActions(root);
    this.bindPetTabs(root);
    this.updateJealousyAlert(root);
    this.startAutoSave();
  }

  private processLoginRewards(): void {
    const loginResult = processLogin(this.ctx.state.current);
    this.ctx.state.current = loginResult.state;
    if (loginResult.reward > 0) {
      showToast(`출석 보상: ${loginResult.reward}G (${loginResult.chainDay}일차)`);
    }
    if (loginResult.streakMilestone) {
      showToast(`연속 ${this.ctx.state.current.streak}일 출석! +${loginResult.streakMilestone}G`);
    }
  }

  private renderPetTabs(state: PetPalState): string {
    const tabs = state.pets.map((pet, i) => {
      const stage = getGrowthStage(pet.type, pet.stats.bond);
      const emoji = PETS[pet.type].stages[stage].emoji;
      const isActive = i === state.activePetIndex;
      const hasJealousy = pet.jealousy > 30;
      return `<button class="pet-tab ${isActive ? 'active' : ''} ${hasJealousy ? 'jealous' : ''}"
                      data-pet-index="${i}" title="${pet.name}">
        ${emoji}
      </button>`;
    }).join('');

    // + 버튼 (슬롯 여유가 있을 때)
    const canAdd = state.unlockedSlots > state.pets.length;
    const addBtn = canAdd
      ? '<button class="pet-tab pet-tab-add" id="btn-add-pet" title="새 펫 추가">+</button>'
      : '';

    return tabs + addBtn;
  }

  private renderStatBars(stats: PetStats): string {
    const statDefs = [
      { key: 'hunger' as const, label: '배고픔', emoji: '🍖', color: COLORS.stat.hunger },
      { key: 'happiness' as const, label: '행복', emoji: '😊', color: COLORS.stat.happiness },
      { key: 'cleanliness' as const, label: '청결', emoji: '✨', color: COLORS.stat.cleanliness },
      { key: 'energy' as const, label: '기력', emoji: '⚡', color: COLORS.stat.energy },
    ];
    return statDefs.map(s => `
      <div class="stat-row">
        <span class="stat-emoji">${s.emoji}</span>
        <div class="stat-track"><div class="stat-fill" style="width:${stats[s.key]}%;background:${s.color}"></div></div>
        <span class="stat-value">${Math.round(stats[s.key])}</span>
      </div>
    `).join('');
  }

  private renderDailyStrip(state: PetPalState): string {
    if (!state.dailyTasks.length) return '';
    const done = allDailyTasksDone(state);
    return `
      <div class="daily-header">
        <span>오늘의 할일</span>
        ${done && !state.dailyTasksClaimed ? `<button class="btn-small btn-accent" id="btn-claim-daily">보상받기 (+${getDailyRewardTotal(state)}G)</button>` : ''}
      </div>
      <div class="daily-tasks">
        ${state.dailyTasks.map(t => `
          <div class="daily-task ${t.progress >= t.target ? 'done' : ''}">
            <span>${t.emoji}</span><span>${t.label}</span>
            <span class="daily-progress">${t.progress}/${t.target}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  private getNextThreshold(pet: PetData): number {
    const thresholds = PETS[pet.type].evolutionThresholds;
    for (const t of thresholds) { if (pet.stats.bond < t) return t; }
    return pet.stats.bond;
  }

  private getBondPercent(pet: PetData): number {
    const thresholds = [0, ...PETS[pet.type].evolutionThresholds];
    const bond = pet.stats.bond;
    for (let i = 1; i < thresholds.length; i++) {
      if (bond < thresholds[i]) {
        return ((bond - thresholds[i - 1]) / (thresholds[i] - thresholds[i - 1])) * 100;
      }
    }
    return 100;
  }

  private bindPetTabs(root: HTMLElement): void {
    root.querySelectorAll('.pet-tab[data-pet-index]').forEach(btn => {
      const handler = (): void => {
        const idx = parseInt((btn as HTMLElement).dataset.petIndex ?? '0', 10);
        this.ctx.sound.playClick();
        this.ctx.state.current.activePetIndex = idx;
        this.ctx.save.save(this.ctx.state.current);
        // 전체 UI 새로고침
        this.ctx.scenes.switchTo(() => new HomeScene(this.ctx));
      };
      btn.addEventListener('click', handler);
      this.cleanups.push(() => btn.removeEventListener('click', handler));
    });

    const addBtn = root.querySelector('#btn-add-pet');
    if (addBtn) {
      const handler = (): void => {
        this.ctx.sound.playClick();
        import('./PetSelectScene').then(m => {
          this.ctx.scenes.switchTo(() => new m.PetSelectScene(this.ctx, 'add'));
        }).catch(err => console.error('[HomeScene] PetSelect load failed', err));
      };
      addBtn.addEventListener('click', handler);
      this.cleanups.push(() => addBtn.removeEventListener('click', handler));
    }
  }

  private bindActions(root: HTMLElement): void {
    root.querySelectorAll('.action-btn').forEach(btn => {
      const handler = (): void => {
        this.ctx.sound.playClick();
        this.handleAction((btn as HTMLElement).dataset.action!, root);
      };
      btn.addEventListener('click', handler);
      this.cleanups.push(() => btn.removeEventListener('click', handler));
    });

    this.bindDailyClaim(root);

    const achBtn = root.querySelector('#btn-achievements');
    if (achBtn) {
      const handler = (): void => {
        this.ctx.sound.playClick();
        import('./AchievementsScene')
          .then(m => this.ctx.scenes.switchTo(() => new m.AchievementsScene(this.ctx)))
          .catch(err => console.error('[HomeScene] load failed', err));
      };
      achBtn.addEventListener('click', handler);
      this.cleanups.push(() => achBtn.removeEventListener('click', handler));
    }
  }

  private bindDailyClaim(root: HTMLElement): void {
    const claimBtn = root.querySelector('#btn-claim-daily');
    if (claimBtn) {
      const handler = (): void => {
        const reward = getDailyRewardTotal(this.ctx.state.current);
        this.ctx.state.current.gold += reward;
        this.ctx.state.current.totalGoldEarned += reward;
        this.ctx.state.current.dailyTasksClaimed = true;
        this.ctx.save.save(this.ctx.state.current);
        this.ctx.sound.playCoin();
        showToast(`데일리 완료! +${reward}G`);
        this.petCanvas?.emitParticles('star', 8);
        this.refreshUI(root);
      };
      claimBtn.addEventListener('click', handler);
      this.cleanups.push(() => claimBtn.removeEventListener('click', handler));
    }
  }

  private handleAction(action: string, root: HTMLElement): void {
    if (this.checkCooldown(action)) return;

    const state = this.ctx.state.current;
    const idx = state.activePetIndex;

    switch (action) {
      case 'feed':
        this.ctx.state.current = applyEffectsToPet(state, idx, { hunger: 25, bond: 1 }, 'feed');
        this.ctx.state.current.totalFeeds++;
        this.ctx.state.current = updateDailyProgress(this.ctx.state.current, 'feed');
        this.petCanvas?.setEmotion('eating');
        this.petCanvas?.showSpeech('맛있어!');
        this.petCanvas?.emitParticles('sparkle', 5);
        this.petCanvas?.triggerJealousy();
        this.ctx.sound.playHarvest();
        break;
      case 'play':
        this.ctx.state.current = applyEffectsToPet(state, idx, { happiness: 30, energy: -10, bond: 2 }, 'play');
        this.ctx.state.current.totalPlays++;
        this.ctx.state.current = updateDailyProgress(this.ctx.state.current, 'play');
        this.petCanvas?.setEmotion('happy');
        this.petCanvas?.showSpeech('재밌다!');
        this.petCanvas?.emitParticles('star', 6);
        this.petCanvas?.triggerJealousy();
        this.ctx.sound.playLucky();
        break;
      case 'walk':
        this.ctx.state.current = applyEffectsToPet(state, idx, { happiness: 20, energy: -15, cleanliness: -5, bond: 3 }, 'walk');
        this.ctx.state.current.totalWalks++;
        this.ctx.state.current = updateDailyProgress(this.ctx.state.current, 'walk');
        this.petCanvas?.setEmotion('happy');
        this.petCanvas?.showSpeech('산책 좋아!');
        this.petCanvas?.emitParticles('leaf', 5);
        this.petCanvas?.triggerJealousy();
        this.ctx.sound.playMerge();
        break;
      case 'clean':
        this.ctx.state.current = applyEffectsToPet(state, idx, { cleanliness: 35, happiness: 5, bond: 1 }, 'clean');
        this.ctx.state.current.totalBaths++;
        this.ctx.state.current = updateDailyProgress(this.ctx.state.current, 'clean');
        this.petCanvas?.showSpeech('깨끗해졌다!');
        this.petCanvas?.emitParticles('bubble', 8);
        this.petCanvas?.triggerJealousy();
        this.ctx.sound.playWater();
        break;
      case 'talk': {
        this.ctx.state.current = applyEffectsToPet(state, idx, { happiness: 15, bond: 2 }, 'talk');
        this.ctx.state.current.totalTalks++;
        this.ctx.state.current = updateDailyProgress(this.ctx.state.current, 'talk');
        const activeStats = getActiveStats(this.ctx.state.current);
        this.petCanvas?.setEmotion('love');
        this.petCanvas?.showSpeech(getPetSpeech(activeStats));
        this.petCanvas?.emitParticles('heart', 6);
        this.petCanvas?.triggerJealousy();
        this.ctx.sound.playClick();
        break;
      }
      case 'shop':
        import('./ShopScene')
          .then(m => this.ctx.scenes.switchTo(() => new m.ShopScene(this.ctx)))
          .catch(err => console.error('[HomeScene] load failed', err));
        return;
      case 'minigame':
        this.showMiniGamePicker(root);
        return;
      case 'profile':
        import('./ProfileScene')
          .then(m => this.ctx.scenes.switchTo(() => new m.ProfileScene(this.ctx)))
          .catch(err => console.error('[HomeScene] load failed', err));
        return;
    }

    this.checkEvolution();
    this.checkAchievements();
    this.ctx.save.save(this.ctx.state.current);
    this.refreshUI(root);
  }

  private checkCooldown(action: string): boolean {
    const cooldown = COOLDOWNS[action];
    if (!cooldown) return false;
    const last = this.lastActionTime[action] ?? 0;
    const remaining = cooldown - (Date.now() - last);
    if (remaining > 0) {
      showToast(`${Math.ceil(remaining / 1000)}초 후에 다시 할 수 있어요`);
      return true;
    }
    this.lastActionTime[action] = Date.now();
    return false;
  }

  private showMiniGamePicker(root: HTMLElement): void {
    const overlay = document.createElement('div');
    overlay.className = 'mg-picker-overlay';
    overlay.innerHTML = `
      <div class="mg-picker">
        <h3>미니게임 선택</h3>
        <button class="mg-pick-btn" data-game="catch"><span>🥣</span>먹이 캐치</button>
        <button class="mg-pick-btn" data-game="walk"><span>🚶</span>산책 달리기</button>
        <button class="mg-pick-btn mg-close">취소</button>
      </div>
    `;
    root.appendChild(overlay);

    overlay.querySelector('[data-game="catch"]')?.addEventListener('click', () => {
      overlay.remove();
      import('./MiniGameScene').then(m => this.ctx.scenes.switchTo(() => new m.MiniGameScene(this.ctx)))
        .catch(err => console.error('[HomeScene] MiniGame load failed', err));
    });
    overlay.querySelector('[data-game="walk"]')?.addEventListener('click', () => {
      overlay.remove();
      import('./WalkGameScene').then(m => this.ctx.scenes.switchTo(() => new m.WalkGameScene(this.ctx)))
        .catch(err => console.error('[HomeScene] WalkGame load failed', err));
    });
    overlay.querySelector('.mg-close')?.addEventListener('click', () => overlay.remove());
  }

  private checkEvolution(): void {
    const state = this.ctx.state.current;
    const pet = getActivePet(state);
    if (!pet) return;

    const prevStage = getGrowthStage(pet.type, pet.stats.bond - 3);
    const newStage = getGrowthStage(pet.type, pet.stats.bond);
    if (prevStage !== newStage) {
      const petDef = PETS[pet.type];
      const info = petDef.stages[newStage];
      showToast(`${pet.name}이(가) ${info.name}(으)로 성장했어요!`);
      this.ctx.sound.playLevelUp();
      this.petCanvas?.updatePet(newStage, info.size);
      this.petCanvas?.emitParticles('star', 12);
    }
  }

  private checkAchievements(): void {
    const newAchs = checkNewAchievements(this.ctx.state.current);
    if (newAchs.length > 0) {
      const result = claimAchievements(this.ctx.state.current, newAchs);
      this.ctx.state.current = result.state;
      for (const ach of newAchs) {
        showToast(`${ach.emoji} ${ach.name} +${ach.reward}G`);
      }
      this.petCanvas?.emitParticles('star', 8);
    }
  }

  private updateJealousyAlert(root: HTMLElement): void {
    const alertEl = root.querySelector('#jealousy-alert') as HTMLElement;
    if (!alertEl) return;

    const state = this.ctx.state.current;
    const jealousPet = state.pets.find((p, i) => i !== state.activePetIndex && p.jealousy > 30);
    if (jealousPet) {
      alertEl.style.display = 'block';
      alertEl.textContent = `${jealousPet.name}이(가) 질투하고 있어요!`;
    } else {
      alertEl.style.display = 'none';
    }
  }

  private refreshUI(root: HTMLElement): void {
    const state = this.ctx.state.current;
    const pet = getActivePet(state);
    if (!pet) return;

    const statBars = root.querySelector('#stat-bars');
    if (statBars) statBars.innerHTML = this.renderStatBars(pet.stats);

    const goldEl = root.querySelector('#gold-amount');
    if (goldEl) goldEl.textContent = String(state.gold);

    const moodEl = root.querySelector('#mood-display');
    if (moodEl) moodEl.textContent = moodEmoji(pet.stats);

    const nameEl = root.querySelector('#pet-name-label');
    if (nameEl) nameEl.textContent = pet.name;

    const dailyStrip = root.querySelector('#daily-strip');
    if (dailyStrip) {
      dailyStrip.innerHTML = this.renderDailyStrip(state);
      this.bindDailyClaim(root);
    }

    const bondFill = root.querySelector('#bond-fill') as HTMLElement;
    const bondLabel = root.querySelector('#bond-label') as HTMLElement;
    if (bondFill) bondFill.style.width = `${this.getBondPercent(pet)}%`;
    if (bondLabel) bondLabel.textContent = `유대감 ${pet.stats.bond} / ${this.getNextThreshold(pet)}`;

    // Pet tabs 업데이트
    const tabsEl = root.querySelector('#pet-tabs');
    if (tabsEl) {
      tabsEl.innerHTML = this.renderPetTabs(state);
      this.bindPetTabs(root);
    }

    // Canvas 동기화
    this.petCanvas?.setPets(state.pets);
    this.petCanvas?.setActivePet(state.activePetIndex);
    this.petCanvas?.setStats(pet.stats);

    this.updateJealousyAlert(root);
  }

  private startAutoSave(): void {
    const interval = window.setInterval(() => {
      this.ctx.save.save(this.ctx.state.current);
    }, 30000);
    this.cleanups.push(() => clearInterval(interval));
  }

  unmount(): void {
    this.cleanups.forEach(fn => fn());
    this.cleanups = [];
    this.petCanvas = null;
  }
}
