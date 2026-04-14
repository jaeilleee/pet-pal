/**
 * HomeScene -- 메인 홈 화면 (멀티펫 Canvas + 돌봄 액션)
 */

import type { Scene } from './SceneManager';
import type { AppContext } from '../app/AppContext';
import type { PetPalState, PetStats, PetData } from '../data/state';
import type { SceneManager } from './SceneManager';
import { PETS, getGrowthStage, getActiveSynergies } from '../data/pets';
import type { GrowthStage, PetType } from '../data/pets';
import {
  getActivePet, getActiveStats, applyEffectsToPet,
  decayAllPets, overallMood, moodEmoji,
  checkSickness, healPet, checkRunawayWarning,
  getActivePetTitle, checkPersonalityMutation, returnRunawayPet,
} from '../data/state';
import { getItemById } from '../data/items';
import {
  processLogin, updateDailyProgress, allDailyTasksDone, getDailyRewardTotal,
  processWeeklyReset, updateWeeklyScore, getWeeklyTierEmoji,
} from '../data/daily';
import { getTimeOfDay, getTimeBackground } from '../data/time-guard';
import { EXPEDITIONS, rollExpeditionRewards } from '../data/expeditions';
import { COLORS } from '../data/design-tokens';
import { drawPet, createAnimState } from '../game/PetRenderer';
import { showToast } from '../ui/Toast';
import { PetCanvas } from '../game/PetCanvas';
import { checkNewAchievements, claimAchievements } from '../data/achievements';
import { getPersonalitySpeech, getSpeechFromCategory } from '../data/speeches';
import { rollVisitor, VISITORS, SEASONAL_VISITORS } from '../data/visitors';
import { rollLuckyDrop } from '../data/lucky-drops';
import { generateAutoEvents } from '../data/auto-events';

type Ctx = AppContext<PetPalState, SceneManager>;

/** 액션 쿨다운 (ms) */
const COOLDOWNS: Record<string, number> = {
  feed: 30_000, play: 45_000, walk: 60_000, clean: 40_000, talk: 15_000,
};

/** 대화 응답 (성격+스탯 연동) */
function getPetSpeech(stats: PetStats, personality?: import('../data/pets').Personality): string {
  if (personality) {
    return getPersonalitySpeech(personality, stats);
  }
  // 성격 없을 때 폴백
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
  /** 펫별 쿨다운: key = "petId:action" */
  private lastActionTime: Record<string, number> = {};

  constructor(ctx: Ctx) {
    this.ctx = ctx;
  }

  mount(root: HTMLElement): void {
    this.processLoginRewards();
    this.processWeeklyRewards();

    // 스탯 감소 + 업적 체크
    this.ctx.state.current = decayAllPets(this.ctx.state.current);
    this.checkAchievements();

    // 질병 체크 (접속 시)
    this.processSicknessCheck();

    // 탐험 귀환 체크
    this.processExpeditionReturns();

    // 가구 효과 안내 (접속 시 1회)
    if (this.ctx.state.current.ownedFurniture.length > 0) {
      const count = this.ctx.state.current.ownedFurniture.length;
      const pct = count >= 3 ? 30 : count >= 2 ? 20 : 10;
      setTimeout(() => showToast(`🏠 가구 효과로 스탯 감소가 ${pct}% 줄었어요!`), 1500);
    }

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
        <div class="ad-banner-slot" id="ad-banner-top"></div>
        <div class="home-header">
          <div class="home-gold"><span class="gold-icon">💰</span><span id="gold-amount">${state.gold}</span>G</div>
          <div class="pet-tabs" id="pet-tabs">${this.renderPetTabs(state)}</div>
          ${this.renderWeeklyBadge(state)}
          <div id="synergy-badges">${this.renderSynergyBadges(state)}</div>
          <div class="home-mood" id="mood-display">${moodEmoji(activePet.stats)}</div>
          <button class="btn-icon" id="btn-achievements">🏆</button>
        </div>

        <div class="home-pet-area" id="pet-container"></div>
        <div id="expedition-indicator">${this.renderExpeditionIndicator(state)}</div>

        <div class="pet-name-display">
          <span class="pet-title-label" id="pet-title-label">${getActivePetTitle(activePet, state)}</span>
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
          ${activePet.isSick ? '<button class="action-btn action-btn-heal" data-action="heal"><span>💊</span>치료 50G</button>' : ''}
          <button class="action-btn action-btn-allcare" data-action="allcare"><span>💖</span>올케어</button>
          <button class="action-btn" data-action="expedition"><span>🗺️</span>탐험</button>
          <button class="action-btn" data-action="shop"><span>🛍️</span>상점</button>
          <button class="action-btn" data-action="minigame"><span>🎮</span>게임</button>
          <button class="action-btn" data-action="photo"><span>📸</span>사진</button>
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
    // 탐험 중 + 가출 중 펫 숨기기
    const expPetIndices = state.expeditions.map(e => e.petIndex);
    const runawayPetIndices = state.pets.map((p, i) => p.isRunaway ? i : -1).filter(i => i >= 0);
    this.petCanvas.setExpeditionPets([...expPetIndices, ...runawayPetIndices]);
    if (isSleeping) this.petCanvas.setEmotion('sleeping');
    this.petCanvas.setRoomTheme(state.activeRoomTheme);
    this.petCanvas.setFurniture(state.ownedFurniture.map(id => getItemById(id)?.emoji ?? ''));
    if (activePet.equippedAccessory) {
      this.petCanvas.setAccessory(getItemById(activePet.equippedAccessory)?.emoji ?? null);
    }
    this.petCanvas.setStats(activePet.stats);

    // 펫 클릭 시 활성 펫 전환 콜백
    this.petCanvas.setPetSelectedCallback((idx: number) => {
      this.ctx.sound.playClick();
      this.ctx.state.current = { ...this.ctx.state.current, activePetIndex: idx };
      this.ctx.save.save(this.ctx.state.current);
      this.petCanvas?.setActivePet(idx);
      this.petCanvas?.setPets(this.ctx.state.current.pets);
      this.refreshUI(root);
    });

    this.petCanvas.start();
    this.cleanups.push(() => this.petCanvas?.stop());

    // 복귀 인사 시스템
    this.showReturnGreeting(state, activePet);

    // 부재 시간 계산
    const absentMs = Date.now() - state.lastDecayAt;
    const absentHours = absentMs / (1000 * 60 * 60);

    // 방문자 시스템
    this.processVisitor(absentHours);

    // 자율 행동 로그
    this.processAutoEvents(activePet, absentHours);

    // 아픈 상태 UI
    this.showSickIndicators(activePet);

    // 가출 펫 알림
    this.showRunawayAlerts(root, state);

    this.bindActions(root);
    this.bindPetTabsDelegation(root);
    this.bindDailyDelegation(root);
    this.updateJealousyAlert(root);
    this.startAutoSave();
  }

  /** 복귀 인사 시스템: 부재 시간에 따라 다른 반응 */
  private showReturnGreeting(state: PetPalState, pet: PetData): void {
    const elapsedMs = Date.now() - state.lastDecayAt;
    const elapsedHours = elapsedMs / (1000 * 60 * 60);

    if (elapsedHours < 2) return; // 2시간 미만이면 인사 없음

    // 약간의 딜레이 후 인사 (Canvas 초기화 이후)
    setTimeout(() => {
      if (!this.petCanvas) return;

      if (elapsedHours >= 24) {
        this.petCanvas.showSpeech(getSpeechFromCategory(pet.personality, 'greeting'));
        showToast(`${pet.name}: 많이 기다렸어...`);
        // 눈물 효과 (love emotion + 파티클 많이)
        this.petCanvas.setEmotion('love');
        this.petCanvas.emitParticles('heart', 20);
      } else if (elapsedHours >= 6) {
        this.petCanvas.showSpeech(getSpeechFromCategory(pet.personality, 'greeting'));
        showToast(`${pet.name}: 보고 싶었어...`);
        this.petCanvas.setEmotion('love');
        this.petCanvas.emitParticles('heart', 12);
      } else {
        // 2시간+
        this.petCanvas.showSpeech(getSpeechFromCategory(pet.personality, 'greeting'));
        this.petCanvas.setEmotion('love');
        this.petCanvas.emitParticles('heart', 5);
      }
    }, 500);
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

    // + 버튼 (최대 3마리 미만이면 항상 표시)
    const addBtn = state.pets.length < 3
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

  private bindActions(root: HTMLElement): void {
    root.querySelectorAll('.action-btn').forEach(btn => {
      const handler = (): void => {
        this.ctx.sound.playClick();
        this.handleAction((btn as HTMLElement).dataset.action!, root);
      };
      btn.addEventListener('click', handler);
      this.cleanups.push(() => btn.removeEventListener('click', handler));
    });

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

  private handleAction(action: string, root: HTMLElement): void {
    if (this.checkCooldown(action)) return;

    const state = this.ctx.state.current;
    const idx = state.activePetIndex;
    const prevBond = getActivePet(state)?.stats.bond ?? 0;

    switch (action) {
      case 'feed':
        this.ctx.state.current = applyEffectsToPet(state, idx, { hunger: 25, bond: 1 }, 'feed');
        this.ctx.state.current.totalFeeds++;
        this.ctx.state.current = updateDailyProgress(this.ctx.state.current, 'feed');
        this.petCanvas?.setEmotion('eating');
        this.petCanvas?.showSpeech('맛있어!');
        this.petCanvas?.showEmoticon('😋');
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
        this.petCanvas?.showEmoticon('🤩');
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
        this.petCanvas?.showEmoticon('🌈');
        this.petCanvas?.emitParticles('leaf', 5);
        this.petCanvas?.triggerJealousy();
        this.ctx.sound.playMerge();
        break;
      case 'clean':
        this.ctx.state.current = applyEffectsToPet(state, idx, { cleanliness: 35, happiness: 5, bond: 1 }, 'clean');
        this.ctx.state.current.totalBaths++;
        this.ctx.state.current = updateDailyProgress(this.ctx.state.current, 'clean');
        this.petCanvas?.showSpeech('깨끗해졌다!');
        this.petCanvas?.showEmoticon('✨');
        this.petCanvas?.emitParticles('bubble', 8);
        this.petCanvas?.triggerJealousy();
        this.ctx.sound.playWater();
        break;
      case 'talk': {
        this.ctx.state.current = applyEffectsToPet(state, idx, { happiness: 15, bond: 2 }, 'talk');
        this.ctx.state.current.totalTalks++;
        this.ctx.state.current = updateDailyProgress(this.ctx.state.current, 'talk');
        const currentPet = getActivePet(this.ctx.state.current);
        const activeStats = getActiveStats(this.ctx.state.current);
        this.petCanvas?.setEmotion('love');
        this.petCanvas?.showSpeech(getPetSpeech(activeStats, currentPet?.personality));
        this.petCanvas?.showEmoticon('💗');
        this.petCanvas?.emitParticles('heart', 6);
        this.petCanvas?.triggerJealousy();
        this.ctx.sound.playClick();
        break;
      }
      case 'allcare':
        this.executeAllCare(root);
        return;
      case 'heal': {
        if (state.gold < 50) {
          showToast('골드가 부족해요! (50G 필요)');
          return;
        }
        const healedPet = healPet(state.pets[idx]);
        const petsAfterHeal = [...state.pets];
        petsAfterHeal[idx] = healedPet;
        this.ctx.state.current = {
          ...this.ctx.state.current,
          pets: petsAfterHeal,
          gold: state.gold - 50,
        };
        showToast('💊 치료 완료! 다시 건강해졌어요!');
        this.petCanvas?.setEmotion('happy');
        this.petCanvas?.showSpeech('기분이 좋아졌어!');
        this.petCanvas?.emitParticles('sparkle', 8);
        this.ctx.sound.playLevelUp();
        break;
      }
      case 'expedition':
        this.showExpeditionPicker(root);
        return;
      case 'shop':
        import('./ShopScene')
          .then(m => this.ctx.scenes.switchTo(() => new m.ShopScene(this.ctx)))
          .catch(err => console.error('[HomeScene] load failed', err));
        return;
      case 'minigame':
        this.showMiniGamePicker(root);
        return;
      case 'photo':
        this.enterPhotoMode(root);
        return;
      case 'profile':
        import('./ProfileScene')
          .then(m => this.ctx.scenes.switchTo(() => new m.ProfileScene(this.ctx)))
          .catch(err => console.error('[HomeScene] load failed', err));
        return;
    }

    this.checkEvolution(prevBond, root);
    this.checkPersonalityMutation();
    this.checkAchievements();

    // 럭키 드롭 (돌봄 액션 후 10% 확률)
    if (['feed', 'play', 'walk', 'clean', 'talk'].includes(action)) {
      this.processLuckyDrop();
    }

    // 데일리 자동 수령
    this.tryAutoClaimDaily();

    this.ctx.save.save(this.ctx.state.current);
    this.refreshUI(root);
  }

  /** 펫별 쿨다운 체크 — 같은 펫에 같은 액션만 쿨다운 */
  private checkCooldown(action: string): boolean {
    const cooldown = COOLDOWNS[action];
    if (!cooldown) return false;
    const petId = this.ctx.state.current.activePetIndex;
    const key = `${petId}:${action}`;
    const last = this.lastActionTime[key] ?? 0;
    const remaining = cooldown - (Date.now() - last);
    if (remaining > 0) {
      showToast(`${Math.ceil(remaining / 1000)}초 후에 다시 할 수 있어요`);
      return true;
    }
    this.lastActionTime[key] = Date.now();
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

  /** 원터치 올케어: 쿨다운 풀린 액션들 순차 실행 */
  private executeAllCare(root: HTMLElement): void {
    const careActions = ['feed', 'play', 'walk', 'clean', 'talk'];
    const available = careActions.filter(action => {
      const cooldown = COOLDOWNS[action];
      if (!cooldown) return true;
      const petId = this.ctx.state.current.activePetIndex;
      const key = `${petId}:${action}`;
      const last = this.lastActionTime[key] ?? 0;
      return (Date.now() - last) >= cooldown;
    });

    if (available.length === 0) {
      showToast('쿨다운 중이에요! 잠시 후 다시 시도하세요');
      return;
    }

    let delay = 0;
    for (const action of available) {
      setTimeout(() => {
        this.handleAction(action, root);
      }, delay);
      delay += 300;
    }

    setTimeout(() => {
      showToast('올케어 완료! 💖');
      this.petCanvas?.emitParticles('star', 10);
    }, delay);
  }

  private checkEvolution(prevBond: number, root: HTMLElement): void {
    const pet = getActivePet(this.ctx.state.current);
    if (!pet) return;

    const prevStage = getGrowthStage(pet.type, prevBond);
    const newStage = getGrowthStage(pet.type, pet.stats.bond);
    if (prevStage !== newStage) {
      const petDef = PETS[pet.type];
      const info = petDef.stages[newStage];
      this.ctx.sound.playLevelUp();
      this.petCanvas?.updatePet(newStage, info.size);
      this.petCanvas?.emitParticles('star', 12);
      this.showEvolutionCutscene(pet.name, prevStage, newStage, pet.type, root);
    }
  }

  /** 진화 연출 (2초 전체화면 오버레이) */
  private showEvolutionCutscene(
    petName: string,
    prevStage: GrowthStage,
    newStage: GrowthStage,
    petType: PetType,
    root: HTMLElement,
  ): void {
    const overlay = document.createElement('div');
    overlay.className = 'evolution-overlay';
    overlay.innerHTML = `
      <canvas id="evolution-canvas" width="600" height="600" style="width:300px;height:300px"></canvas>
      <div class="evolution-text">
        <div class="evolution-congrats">🎉 축하합니다! 🎉</div>
        <div class="evolution-desc">${petName}이(가) ${PETS[petType].stages[newStage].name}(으)로 진화했어요!</div>
      </div>
    `;
    root.appendChild(overlay);

    const canvas = overlay.querySelector('#evolution-canvas') as HTMLCanvasElement;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) { overlay.remove(); return; }
    ctx2d.scale(2, 2);

    const prevInfo = PETS[petType].stages[prevStage];
    const newInfo = PETS[petType].stages[newStage];
    const cx = 150;
    const cy = 150;
    let progress = 0;
    const startTime = performance.now();
    const duration = 2000;

    const animate = (now: number): void => {
      progress = Math.min(1, (now - startTime) / duration);
      ctx2d.clearRect(0, 0, 300, 300);

      // 어두운 배경
      ctx2d.fillStyle = `rgba(0,0,0,${0.6 + 0.2 * Math.sin(progress * Math.PI)})`;
      ctx2d.fillRect(0, 0, 300, 300);

      // 빛 효과 (중앙에서 퍼지는 원)
      const lightRadius = 30 + progress * 120;
      const lightAlpha = 0.3 + 0.5 * Math.sin(progress * Math.PI);
      const grad = ctx2d.createRadialGradient(cx, cy, 0, cx, cy, lightRadius);
      grad.addColorStop(0, `rgba(255,255,200,${lightAlpha})`);
      grad.addColorStop(0.5, `rgba(255,220,100,${lightAlpha * 0.5})`);
      grad.addColorStop(1, 'rgba(255,220,100,0)');
      ctx2d.fillStyle = grad;
      ctx2d.fillRect(0, 0, 300, 300);

      // 전환: 전반부 = 이전 모습(fade out), 후반부 = 새 모습(fade in)
      const anim = createAnimState();
      anim.emotion = 'happy';

      if (progress < 0.5) {
        // 이전 모습 (fade out + 떨림)
        const fadeOut = 1 - progress * 2;
        ctx2d.globalAlpha = fadeOut;
        const shake = Math.sin(progress * 40) * 3;
        drawPet(ctx2d, petType, prevStage, anim, cx + shake, cy, prevInfo.size * 1.2, undefined);
        ctx2d.globalAlpha = 1;
      } else {
        // 새 모습 (fade in + 확대)
        const fadeIn = (progress - 0.5) * 2;
        const scale = 0.5 + fadeIn * 0.5;
        ctx2d.globalAlpha = fadeIn;
        ctx2d.save();
        ctx2d.translate(cx, cy);
        ctx2d.scale(scale, scale);
        drawPet(ctx2d, petType, newStage, anim, 0, 0, newInfo.size * 1.2, undefined);
        ctx2d.restore();
        ctx2d.globalAlpha = 1;
      }

      // 파티클 별
      if (progress > 0.4) {
        const pCount = Math.floor((progress - 0.4) * 20);
        ctx2d.fillStyle = '#FFD700';
        for (let i = 0; i < pCount; i++) {
          const angle = (i / pCount) * Math.PI * 2 + progress * 3;
          const dist = 60 + Math.sin(progress * 6 + i) * 30;
          const sx = cx + Math.cos(angle) * dist;
          const sy = cy + Math.sin(angle) * dist;
          ctx2d.beginPath();
          ctx2d.arc(sx, sy, 2 + Math.random() * 3, 0, Math.PI * 2);
          ctx2d.fill();
        }
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // 2초 후 자동 닫힘
        setTimeout(() => overlay.remove(), 200);
      }
    };

    requestAnimationFrame(animate);

    // 클릭으로도 닫기 가능
    overlay.addEventListener('click', () => overlay.remove());
  }

  /** 데일리 태스크 전체 완료 시 자동 수령 */
  private tryAutoClaimDaily(): void {
    const state = this.ctx.state.current;
    if (state.dailyTasksClaimed) return;
    if (!allDailyTasksDone(state)) return;

    const reward = getDailyRewardTotal(state);
    this.ctx.state.current = {
      ...state,
      gold: state.gold + reward,
      totalGoldEarned: state.totalGoldEarned + reward,
      dailyTasksClaimed: true,
    };
    this.ctx.sound.playCoin();
    showToast(`데일리 자동 완료! +${reward}G 🎉`);
    this.petCanvas?.emitParticles('star', 8);
  }

  /** 활성 시너지 배지 렌더 */
  private renderSynergyBadges(state: PetPalState): string {
    const petTypes = state.pets.map(p => p.type);
    const synergies = getActiveSynergies(petTypes);
    if (synergies.length === 0) return '';
    return synergies.map(s =>
      `<span class="synergy-badge" title="${s.bonus}">${s.emoji} ${s.name}</span>`
    ).join('');
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

  /** 질병 체크: 모든 펫에 대해 접속 시 실행 */
  private processSicknessCheck(): void {
    const state = this.ctx.state.current;
    const runawayPetNames: string[] = [];
    const pets = state.pets.map(pet => {
      const checked = checkSickness(pet);
      const { pet: warned, warn, ranAway } = checkRunawayWarning(checked);
      if (warn) {
        showToast(`⚠️ ${warned.name}이(가) 너무 오래 아팠어요! 가출 경고!`);
      }
      if (ranAway) {
        runawayPetNames.push(warned.name);
      }
      return warned;
    });
    this.ctx.state.current = { ...state, pets };

    // 가출 알림
    for (const name of runawayPetNames) {
      showToast(`${name}이(가) 가출했어요! 찾으러 가세요!`);
    }
  }

  /** 가출 펫 알림 표시 */
  private showRunawayAlerts(root: HTMLElement, state: PetPalState): void {
    const runawayPets = state.pets.filter(p => p.isRunaway);
    if (runawayPets.length === 0) return;

    for (const pet of runawayPets) {
      const petIndex = state.pets.indexOf(pet);
      const alert = document.createElement('div');
      alert.className = 'runaway-alert';
      alert.innerHTML = `
        <span>🚨 ${pet.name}이(가) 가출했어요!</span>
        <button class="btn-primary btn-small btn-find-pet" data-runaway-idx="${petIndex}">찾으러 가기</button>
      `;
      const petContainer = root.querySelector('#pet-container');
      if (petContainer) {
        petContainer.insertAdjacentElement('afterend', alert);
      }

      const findBtn = alert.querySelector('.btn-find-pet') as HTMLElement;
      const handler = (): void => {
        this.ctx.sound.playClick();
        this.showRunawaySearch(root, petIndex);
      };
      findBtn.addEventListener('click', handler);
      this.cleanups.push(() => findBtn.removeEventListener('click', handler));
    }
  }

  /** 성격 변이 체크 */
  private checkPersonalityMutation(): void {
    const state = this.ctx.state.current;
    const idx = state.activePetIndex;
    const pet = state.pets[idx];
    if (!pet) return;

    const { pet: mutated, mutated: didMutate, newPersonality } = checkPersonalityMutation(pet);
    if (didMutate && newPersonality) {
      const pets = [...state.pets];
      pets[idx] = mutated;
      this.ctx.state.current = { ...state, pets };
      const personalityNames: Record<string, string> = {
        active: '활발한', foodie: '먹보', gentle: '온순한', playful: '장난꾸러기', sleepy: '졸린',
      };
      showToast(`✨ ${pet.name}의 성격이 ${personalityNames[newPersonality]}(으)로 변했어요!`);
      this.petCanvas?.emitParticles('star', 10);
      this.ctx.sound.playLevelUp();
    }
  }

  /** 가출 펫 찾기 미니게임 표시 */
  private showRunawaySearch(root: HTMLElement, petIndex: number): void {
    const state = this.ctx.state.current;
    const pet = state.pets[petIndex];
    if (!pet) return;

    const stage = getGrowthStage(pet.type, pet.stats.bond);
    const petEmoji = PETS[pet.type].stages[stage].emoji;

    const overlay = document.createElement('div');
    overlay.className = 'runaway-overlay';

    // 3개 실루엣 중 진짜 찾기
    const positions = [0, 1, 2];
    const realPos = Math.floor(Math.random() * 3);
    const decoys = ['🌳', '🪨'];

    overlay.innerHTML = `
      <div class="runaway-game">
        <h3>🔍 ${pet.name}을(를) 찾아요!</h3>
        <p class="runaway-hint">숲에서 ${pet.name}을(를) 찾아주세요!</p>
        <div class="runaway-forest">
          <div class="forest-bg">🌲🌳🌿🍃🌲🌳🌿🍃🌲</div>
          <div class="runaway-silhouettes">
            ${positions.map(i => `
              <button class="silhouette-btn" data-pos="${i}">
                <span class="silhouette-shadow">${i === realPos ? petEmoji : decoys[i > realPos ? i - 1 : i]}</span>
              </button>
            `).join('')}
          </div>
        </div>
        <button class="btn-secondary btn-small runaway-cancel">포기하기</button>
      </div>
    `;
    root.appendChild(overlay);

    // 클릭 이벤트
    overlay.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.silhouette-btn') as HTMLElement | null;
      if (btn) {
        const pos = parseInt(btn.dataset.pos ?? '-1', 10);
        if (pos === realPos) {
          // 성공!
          const pets = [...this.ctx.state.current.pets];
          pets[petIndex] = returnRunawayPet(pets[petIndex]);
          this.ctx.state.current = { ...this.ctx.state.current, pets };
          this.ctx.save.save(this.ctx.state.current);

          overlay.remove();
          showToast(`🎉 ${pet.name}을(를) 찾았어요! 돌아와줘서 고마워!`);
          this.petCanvas?.showSpeech('돌아와줘서 고마워!');
          this.petCanvas?.emitParticles('heart', 15);
          this.petCanvas?.setPets(this.ctx.state.current.pets);
          this.ctx.sound.playLevelUp();
          this.refreshUI(root);
        } else {
          // 실패 — 다시 시도
          btn.classList.add('wrong');
          btn.setAttribute('disabled', 'true');
          showToast('여기가 아니에요! 다시 찾아보세요');
          this.ctx.sound.playClick();
        }
        return;
      }

      if ((e.target as HTMLElement).closest('.runaway-cancel')) {
        overlay.remove();
      }
    });
  }

  /** 아픈 상태 UI 표시 */
  private showSickIndicators(pet: PetData): void {
    if (!pet.isSick) return;
    setTimeout(() => {
      if (!this.petCanvas) return;
      this.petCanvas.showSpeech('아파요...');
      showToast(`💊 ${pet.name}이(가) 아파요! 약을 먹여주세요!`);
    }, 800);
  }

  /** 방문자 시스템 처리 */
  private processVisitor(absentHours: number): void {
    const visitor = rollVisitor(absentHours);
    if (!visitor) return;

    const state = this.ctx.state.current;
    this.ctx.state.current = {
      ...state,
      currentVisitor: { id: visitor.id, arrivedAt: Date.now() },
    };

    // Canvas에 방문자 표시
    this.petCanvas?.setVisitor(visitor.emoji);

    setTimeout(() => {
      const rarityLabel = visitor.rarity === 'legendary' ? '✨전설✨ '
        : visitor.rarity === 'rare' ? '⭐희귀⭐ '
        : '';
      showToast(`${rarityLabel}${visitor.name}이(가) 놀러왔어요!`);
      this.petCanvas?.showSpeech(visitor.message);
    }, 1200);

    // 방문자 클릭 시 선물 수령 (3초 후 자동 수령)
    setTimeout(() => {
      this.claimVisitorGift(visitor.id);
    }, 4000);
  }

  /** 방문자 선물 수령 */
  private claimVisitorGift(visitorId: string): void {
    const visitor = VISITORS.find(v => v.id === visitorId)
      ?? SEASONAL_VISITORS.find(v => v.id === visitorId);
    if (!visitor) return;

    const state = this.ctx.state.current;
    if (!state.currentVisitor) return;

    const visitorLog = state.visitorLog.includes(visitorId)
      ? state.visitorLog
      : [...state.visitorLog, visitorId];

    this.ctx.state.current = {
      ...state,
      gold: state.gold + visitor.gift.gold,
      totalGoldEarned: state.totalGoldEarned + visitor.gift.gold,
      visitorLog,
      currentVisitor: null,
    };
    this.ctx.save.save(this.ctx.state.current);

    showToast(`${visitor.emoji} ${visitor.name}에게 ${visitor.gift.gold}G 선물 받았어요!`);
    this.petCanvas?.emitParticles('star', 6);
    this.ctx.sound.playCoin();

    // 방문자 퇴장
    this.petCanvas?.setVisitor(null);
  }

  /** 럭키 드롭 처리 */
  private processLuckyDrop(): void {
    const drop = rollLuckyDrop();
    if (!drop) return;

    const state = this.ctx.state.current;
    if (drop.type === 'gold') {
      this.ctx.state.current = {
        ...state,
        gold: state.gold + drop.value,
        totalGoldEarned: state.totalGoldEarned + drop.value,
      };
    } else if (drop.type === 'bond') {
      const idx = state.activePetIndex;
      const pets = [...state.pets];
      const pet = { ...pets[idx] };
      pet.stats = { ...pet.stats, bond: pet.stats.bond + drop.value };
      pets[idx] = pet;
      this.ctx.state.current = { ...state, pets };
    }

    showToast(`🎉 럭키! ${drop.emoji} ${drop.label}`);
    this.petCanvas?.emitParticles('star', 8);
    this.ctx.sound.playLucky();
  }

  /** 자율 행동 로그 (부재 중 펫 행동) */
  private processAutoEvents(pet: PetData, absentHours: number): void {
    const events = generateAutoEvents(pet.personality, absentHours);
    if (events.length === 0) return;

    // 일기에 추가
    const state = this.ctx.state.current;
    const newEntries = events.map(text => ({
      date: new Date().toISOString().slice(0, 10),
      emoji: '📝',
      text: `[자율행동] ${text}`,
      petName: pet.name,
    }));
    this.ctx.state.current = {
      ...state,
      diaryEntries: [...state.diaryEntries, ...newEntries].slice(-50), // 최근 50개만
    };

    // 순차 말풍선 표시 (2초 간격)
    events.forEach((event, i) => {
      setTimeout(() => {
        if (!this.petCanvas) return;
        this.petCanvas.showSpeech(event);
      }, 2000 + i * 2500);
    });
  }

  private updateJealousyAlert(root: HTMLElement): void {
    const alertEl = root.querySelector('#jealousy-alert') as HTMLElement;
    if (!alertEl) return;

    const state = this.ctx.state.current;
    const jealousPet = state.pets.find((p, i) => i !== state.activePetIndex && p.jealousy > 30);
    if (jealousPet) {
      alertEl.style.display = 'block';
      const j = jealousPet.jealousy;
      if (j > 80) {
        alertEl.textContent = `😤 ${jealousPet.name}: "나는요?! 나도 놀아줘!!"`;
      } else if (j > 60) {
        alertEl.textContent = `😠 ${jealousPet.name}이(가) 삐졌어요...`;
      } else if (j > 40) {
        alertEl.textContent = `🥺 ${jealousPet.name}이(가) 부러워하고 있어요`;
      } else {
        alertEl.textContent = `👀 ${jealousPet.name}이(가) 슬쩍 쳐다보고 있어요`;
      }
    } else {
      alertEl.style.display = 'none';
    }
  }

  /** 이벤트 위임: #pet-tabs 컨테이너에 단일 click (mount에서 1회) */
  private bindPetTabsDelegation(root: HTMLElement): void {
    const tabsContainer = root.querySelector('#pet-tabs');
    if (!tabsContainer) return;
    const handler = (e: Event): void => {
      const target = (e.target as HTMLElement).closest('[data-pet-index]') as HTMLElement | null;
      if (target) {
        const idx = parseInt(target.dataset.petIndex ?? '0', 10);
        this.ctx.sound.playClick();
        this.ctx.state.current = { ...this.ctx.state.current, activePetIndex: idx };
        this.ctx.save.save(this.ctx.state.current);
        this.petCanvas?.setActivePet(idx);
        this.petCanvas?.setPets(this.ctx.state.current.pets);
        this.refreshUI(root);
        return;
      }
      // + 버튼
      const addBtn = (e.target as HTMLElement).closest('#btn-add-pet');
      if (addBtn) {
        this.ctx.sound.playClick();
        const state = this.ctx.state.current;
        if (state.pets.length >= state.unlockedSlots) {
          showToast('상점에서 펫 슬롯을 해금하세요! 🛍️');
          import('./ShopScene').then(m => {
            this.ctx.scenes.switchTo(() => new m.ShopScene(this.ctx));
          }).catch(err => console.error('[HomeScene] Shop load failed', err));
        } else {
          import('./PetSelectScene').then(m => {
            this.ctx.scenes.switchTo(() => new m.PetSelectScene(this.ctx, 'add'));
          }).catch(err => console.error('[HomeScene] PetSelect load failed', err));
        }
      }
    };
    tabsContainer.addEventListener('click', handler);
    this.cleanups.push(() => tabsContainer.removeEventListener('click', handler));
  }

  /** 이벤트 위임: #daily-strip 컨테이너에 단일 click (mount에서 1회) */
  private bindDailyDelegation(root: HTMLElement): void {
    const strip = root.querySelector('#daily-strip');
    if (!strip) return;
    const handler = (e: Event): void => {
      const claimBtn = (e.target as HTMLElement).closest('#btn-claim-daily');
      if (!claimBtn) return;
      const reward = getDailyRewardTotal(this.ctx.state.current);
      this.ctx.state.current = {
        ...this.ctx.state.current,
        gold: this.ctx.state.current.gold + reward,
        totalGoldEarned: this.ctx.state.current.totalGoldEarned + reward,
        dailyTasksClaimed: true,
      };
      this.ctx.save.save(this.ctx.state.current);
      this.ctx.sound.playCoin();
      showToast(`데일리 완료! +${reward}G`);
      this.petCanvas?.emitParticles('star', 8);
      this.refreshUI(root);
    };
    strip.addEventListener('click', handler);
    this.cleanups.push(() => strip.removeEventListener('click', handler));
  }

  private refreshUI(root: HTMLElement): void {
    const state = this.ctx.state.current;
    const pet = getActivePet(state);
    if (!pet) return;

    const stage = getGrowthStage(pet.type, pet.stats.bond);
    const stageInfo = PETS[pet.type].stages[stage];

    const statBars = root.querySelector('#stat-bars');
    if (statBars) statBars.innerHTML = this.renderStatBars(pet.stats);

    const goldEl = root.querySelector('#gold-amount');
    if (goldEl) goldEl.textContent = String(state.gold);

    const moodEl = root.querySelector('#mood-display');
    if (moodEl) moodEl.textContent = moodEmoji(pet.stats);

    const titleEl = root.querySelector('#pet-title-label');
    if (titleEl) titleEl.textContent = getActivePetTitle(pet, state);

    const nameEl = root.querySelector('#pet-name-label');
    if (nameEl) nameEl.textContent = pet.name;

    const stageEl = root.querySelector('#pet-stage-label');
    if (stageEl) stageEl.textContent = stageInfo.name;

    // Daily strip (innerHTML만 교체, 리스너는 위임으로 처리)
    const dailyStrip = root.querySelector('#daily-strip');
    if (dailyStrip) dailyStrip.innerHTML = this.renderDailyStrip(state);

    const bondFill = root.querySelector('#bond-fill') as HTMLElement;
    const bondLabel = root.querySelector('#bond-label') as HTMLElement;
    if (bondFill) bondFill.style.width = `${this.getBondPercent(pet)}%`;
    if (bondLabel) bondLabel.textContent = `유대감 ${pet.stats.bond} / ${this.getNextThreshold(pet)}`;

    // Pet tabs (innerHTML만 교체, 리스너는 위임으로 처리)
    const tabsEl = root.querySelector('#pet-tabs');
    if (tabsEl) tabsEl.innerHTML = this.renderPetTabs(state);

    // Expedition indicator 갱신
    const expEl = root.querySelector('#expedition-indicator');
    if (expEl) expEl.innerHTML = this.renderExpeditionIndicator(state);

    // Synergy badges 갱신
    const synergyEl = root.querySelector('#synergy-badges');
    if (synergyEl) synergyEl.innerHTML = this.renderSynergyBadges(state);

    // Canvas 동기화
    this.petCanvas?.setPets(state.pets);
    this.petCanvas?.setActivePet(state.activePetIndex);
    this.petCanvas?.setStats(pet.stats);
    this.petCanvas?.setRoomTheme(state.activeRoomTheme);

    this.updateJealousyAlert(root);
  }

  // === Weekly Tournament ===

  private processWeeklyRewards(): void {
    const result = processWeeklyReset(this.ctx.state.current);
    this.ctx.state.current = result.state;
    if (result.reward > 0) {
      const emoji = getWeeklyTierEmoji(result.prevTier);
      showToast(`${emoji} 지난주 ${result.prevTier} 티어 보상: +${result.reward}G`);
    }
  }

  private renderWeeklyBadge(state: PetPalState): string {
    if (state.weeklyTier === 'none' && state.weeklyBestScore === 0) return '';
    const emoji = getWeeklyTierEmoji(state.weeklyTier);
    const tierLabel = state.weeklyTier === 'none' ? '' : state.weeklyTier.toUpperCase();
    return `<div class="weekly-badge" id="weekly-badge" title="이번 주 최고: ${state.weeklyBestScore}점">
      ${emoji || '🏅'} <span class="weekly-score">${state.weeklyBestScore}</span> ${tierLabel}
    </div>`;
  }

  // === Expedition System ===

  private renderExpeditionIndicator(state: PetPalState): string {
    if (state.expeditions.length === 0) return '';
    return state.expeditions.map(exp => {
      const pet = state.pets[exp.petIndex];
      if (!pet) return '';
      const expDef = EXPEDITIONS.find(e => e.id === exp.expeditionId);
      if (!expDef) return '';
      const remaining = (exp.startedAt + exp.durationMs) - Date.now();
      if (remaining <= 0) return '';
      const mins = Math.ceil(remaining / 60000);
      const label = mins >= 60 ? `${Math.floor(mins / 60)}시간 ${mins % 60}분` : `${mins}분`;
      return `<div class="expedition-status">🗺️ ${pet.name} → ${expDef.emoji} ${expDef.name} (${label} 남음)</div>`;
    }).join('');
  }

  private processExpeditionReturns(): void {
    const state = this.ctx.state.current;
    const now = Date.now();
    const remaining: typeof state.expeditions = [];
    let changed = false;

    for (const exp of state.expeditions) {
      if (now >= exp.startedAt + exp.durationMs) {
        // 귀환!
        changed = true;
        const pet = state.pets[exp.petIndex];
        const expDef = EXPEDITIONS.find(e => e.id === exp.expeditionId);
        if (!pet || !expDef) continue;

        const personalityMatch = expDef.bonusPersonality === pet.personality;
        const rewards = rollExpeditionRewards(expDef, personalityMatch);

        let goldTotal = 0;
        let bondTotal = 0;
        const rewardLabels: string[] = [];
        const itemIds: string[] = [];

        for (const r of rewards) {
          if (r.type === 'gold') goldTotal += r.value;
          else if (r.type === 'bond') bondTotal += r.value;
          else if (r.type === 'item' && r.itemId) itemIds.push(r.itemId);
          rewardLabels.push(r.label);
        }

        this.ctx.state.current.gold += goldTotal;
        this.ctx.state.current.totalGoldEarned += goldTotal;
        if (bondTotal > 0) {
          const pets = [...this.ctx.state.current.pets];
          const p = { ...pets[exp.petIndex] };
          p.stats = { ...p.stats, bond: p.stats.bond + bondTotal };
          pets[exp.petIndex] = p;
          this.ctx.state.current.pets = pets;
        }
        // 아이템 보상 추가
        if (itemIds.length > 0) {
          const owned = [...this.ctx.state.current.ownedItems];
          for (const itemId of itemIds) {
            if (!owned.includes(itemId)) {
              owned.push(itemId);
            }
          }
          this.ctx.state.current.ownedItems = owned;
        }

        const matchBonus = personalityMatch ? ' (성격 보너스!)' : '';
        showToast(`${expDef.emoji} ${pet.name} 탐험 귀환! ${rewardLabels.join(', ')}${matchBonus}`);
      } else {
        remaining.push(exp);
      }
    }

    if (changed) {
      this.ctx.state.current = { ...this.ctx.state.current, expeditions: remaining };
      this.ctx.save.save(this.ctx.state.current);
    }
  }

  private showExpeditionPicker(root: HTMLElement): void {
    const state = this.ctx.state.current;
    const activePet = getActivePet(state);
    if (!activePet) return;

    // 이미 탐험 중인지 체크
    const isOnExpedition = state.expeditions.some(e => e.petIndex === state.activePetIndex);
    if (isOnExpedition) {
      showToast('이 펫은 이미 탐험 중이에요!');
      return;
    }

    const stage = getGrowthStage(activePet.type, activePet.stats.bond);
    const isAdult = stage === 'adult';

    const overlay = document.createElement('div');
    overlay.className = 'mg-picker-overlay';
    overlay.innerHTML = `
      <div class="expedition-picker">
        <h3>🗺️ 탐험 보내기</h3>
        <p class="expedition-pet-label">${activePet.name} 파견</p>
        <div class="expedition-list">
          ${EXPEDITIONS.map(exp => {
            const locked = exp.requiresAdult && !isAdult;
            const matchBonus = exp.bonusPersonality === activePet.personality;
            return `<button class="expedition-item ${locked ? 'locked' : ''}"
                            data-exp-id="${exp.id}" ${locked ? 'disabled' : ''}>
              <span class="exp-emoji">${exp.emoji}</span>
              <div class="exp-info">
                <span class="exp-name">${exp.name}</span>
                <span class="exp-duration">${exp.durationHours}시간</span>
                ${matchBonus ? '<span class="exp-bonus">✨ 성격 보너스</span>' : ''}
              </div>
              ${locked ? '<span class="exp-lock">🔒 성체 전용</span>' : ''}
            </button>`;
          }).join('')}
        </div>
        <button class="mg-pick-btn mg-close">취소</button>
      </div>
    `;
    root.appendChild(overlay);

    // 이벤트 위임
    const handler = (e: Event): void => {
      const target = (e.target as HTMLElement).closest('[data-exp-id]') as HTMLElement | null;
      if (target && !target.hasAttribute('disabled')) {
        const expId = target.dataset.expId!;
        this.startExpedition(expId, root);
        overlay.remove();
        return;
      }
      if ((e.target as HTMLElement).closest('.mg-close')) {
        overlay.remove();
      }
    };
    overlay.addEventListener('click', handler);
  }

  private startExpedition(expeditionId: string, root: HTMLElement): void {
    const expDef = EXPEDITIONS.find(e => e.id === expeditionId);
    if (!expDef) return;

    const state = this.ctx.state.current;
    const idx = state.activePetIndex;
    const pet = state.pets[idx];
    if (!pet) return;

    const expedition = {
      petIndex: idx,
      expeditionId,
      startedAt: Date.now(),
      durationMs: expDef.durationHours * 60 * 60 * 1000,
    };

    this.ctx.state.current = {
      ...state,
      expeditions: [...state.expeditions, expedition],
    };
    this.ctx.save.save(this.ctx.state.current);

    // Canvas에서 펫 숨기기
    const expIndices = this.ctx.state.current.expeditions.map(e => e.petIndex);
    this.petCanvas?.setExpeditionPets(expIndices);

    showToast(`${expDef.emoji} ${pet.name}이(가) ${expDef.name}으로 탐험을 떠났어요!`);
    this.ctx.sound.playMerge();
    this.refreshUI(root);
  }

  // === Photo Mode ===

  private enterPhotoMode(root: HTMLElement): void {
    if (!this.petCanvas) return;
    const state = this.ctx.state.current;
    const pet = getActivePet(state);
    if (!pet) return;

    // 전체 화면 포토 모드 오버레이
    const overlay = document.createElement('div');
    overlay.className = 'photo-overlay';
    overlay.innerHTML = `
      <div class="photo-header">
        <button class="photo-exit-btn" id="btn-photo-exit">← 돌아가기</button>
        <span class="photo-title">📸 ${pet.name} 사진관</span>
      </div>
      <div class="photo-canvas-wrap" id="photo-canvas-wrap"></div>
      <div class="photo-controls">
        <div class="photo-pose-selector">
          <span class="photo-label">포즈</span>
          <button class="photo-pose-btn active" data-pose="happy">😊</button>
          <button class="photo-pose-btn" data-pose="love">😍</button>
          <button class="photo-pose-btn" data-pose="sleeping">😴</button>
          <button class="photo-pose-btn" data-pose="neutral">🙂</button>
        </div>
        <button class="photo-capture-btn" id="btn-capture">
          <span class="capture-circle"></span>
        </button>
        <p class="photo-hint">큰 버튼을 눌러 촬영하세요</p>
      </div>
    `;
    root.appendChild(overlay);

    // 포토용 고해상도 Canvas 생성
    const wrap = overlay.querySelector('#photo-canvas-wrap') as HTMLElement;
    const photoCanvas = document.createElement('canvas');
    const pSize = 300;
    photoCanvas.width = pSize * 2;
    photoCanvas.height = pSize * 2;
    photoCanvas.style.width = `${pSize}px`;
    photoCanvas.style.height = `${pSize}px`;
    photoCanvas.className = 'photo-canvas';
    wrap.appendChild(photoCanvas);

    const pctx = photoCanvas.getContext('2d');
    if (!pctx) return;
    pctx.scale(2, 2);

    let currentPose: 'happy' | 'love' | 'sleeping' | 'neutral' = 'happy';

    // 포토 Canvas 렌더 함수
    const renderPhotoFrame = (): void => {
      if (!pctx) return;
      const anim = createAnimState();
      anim.emotion = currentPose === 'neutral' ? 'neutral' : currentPose;

      // 배경
      const grad = pctx.createLinearGradient(0, 0, 0, pSize);
      grad.addColorStop(0, '#FFF3E0');
      grad.addColorStop(1, '#E8F4FD');
      pctx.fillStyle = grad;
      pctx.fillRect(0, 0, pSize, pSize);

      // 바닥
      pctx.fillStyle = '#D7CCC8';
      pctx.fillRect(0, pSize * 0.75, pSize, pSize * 0.25);

      // 장식
      pctx.fillStyle = 'rgba(255,183,197,0.2)';
      for (let i = 0; i < 8; i++) {
        pctx.beginPath();
        pctx.arc(30 + i * 38, 20 + (i % 2) * 15, 4, 0, Math.PI * 2);
        pctx.fill();
      }

      // 펫 (크게)
      const stage = getGrowthStage(pet.type, pet.stats.bond);
      const stageInfo = PETS[pet.type].stages[stage];
      drawPet(pctx, pet.type, stage, anim, pSize / 2, pSize / 2 + 20, stageInfo.size * 1.5, pet.stats);

      // 이름 태그
      pctx.fillStyle = 'rgba(255,255,255,0.85)';
      pctx.beginPath();
      const tagW = 120;
      const tagH = 24;
      const tagX = pSize / 2 - tagW / 2;
      const tagY = pSize - 35;
      pctx.roundRect(tagX, tagY, tagW, tagH, 12);
      pctx.fill();
      pctx.fillStyle = '#212121';
      pctx.font = '12px Quicksand, Pretendard, sans-serif';
      pctx.textAlign = 'center';
      pctx.textBaseline = 'middle';
      pctx.fillText(`${pet.name} · ${stageInfo.name}`, pSize / 2, tagY + tagH / 2);
    };

    renderPhotoFrame();

    // 이벤트
    overlay.addEventListener('click', (e) => {
      const poseBtn = (e.target as HTMLElement).closest('[data-pose]') as HTMLElement | null;
      if (poseBtn) {
        currentPose = poseBtn.dataset.pose as typeof currentPose;
        overlay.querySelectorAll('.photo-pose-btn').forEach(b => b.classList.remove('active'));
        poseBtn.classList.add('active');
        this.ctx.sound.playClick();
        renderPhotoFrame();
        return;
      }

      if ((e.target as HTMLElement).closest('#btn-capture')) {
        // 플래시
        pctx.fillStyle = 'rgba(255,255,255,0.9)';
        pctx.fillRect(0, 0, pSize, pSize);
        this.ctx.sound.playLucky();

        setTimeout(() => {
          renderPhotoFrame();
          const dataUrl = photoCanvas.toDataURL('image/png');
          this.sharePhoto(dataUrl);
          showToast('📸 사진 저장!');
        }, 200);
        return;
      }

      if ((e.target as HTMLElement).closest('#btn-photo-exit')) {
        overlay.remove();
        this.ctx.sound.playClick();
      }
    });
  }

  private sharePhoto(dataUrl: string): void {
    if (navigator.share && navigator.canShare) {
      fetch(dataUrl)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], 'petpal-photo.png', { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            navigator.share({ title: 'PetPal', text: '내 펫을 봐주세요!', files: [file] })
              .catch(err => {
                if (err instanceof Error && err.name !== 'AbortError') {
                  this.downloadPhoto(dataUrl);
                }
              });
          } else {
            this.downloadPhoto(dataUrl);
          }
        })
        .catch(() => this.downloadPhoto(dataUrl));
    } else {
      this.downloadPhoto(dataUrl);
    }
  }

  private downloadPhoto(dataUrl: string): void {
    const link = document.createElement('a');
    link.download = `petpal-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
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
