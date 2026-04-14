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
  checkSickness, healPet, checkRunawayWarning,
} from '../data/state';
import { getItemById } from '../data/items';
import { processLogin, updateDailyProgress, allDailyTasksDone, getDailyRewardTotal } from '../data/daily';
import { getTimeOfDay, getTimeBackground } from '../data/time-guard';
import { COLORS } from '../data/design-tokens';
import { showToast } from '../ui/Toast';
import { PetCanvas } from '../game/PetCanvas';
import { checkNewAchievements, claimAchievements } from '../data/achievements';
import { getPersonalitySpeech, getSpeechFromCategory } from '../data/speeches';
import { rollVisitor, VISITORS } from '../data/visitors';
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

    // 스탯 감소 + 업적 체크
    this.ctx.state.current = decayAllPets(this.ctx.state.current);
    this.checkAchievements();

    // 질병 체크 (접속 시)
    this.processSicknessCheck();

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
          ${activePet.isSick ? '<button class="action-btn action-btn-heal" data-action="heal"><span>💊</span>치료 50G</button>' : ''}
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
        const currentPet = getActivePet(this.ctx.state.current);
        const activeStats = getActiveStats(this.ctx.state.current);
        this.petCanvas?.setEmotion('love');
        this.petCanvas?.showSpeech(getPetSpeech(activeStats, currentPet?.personality));
        this.petCanvas?.emitParticles('heart', 6);
        this.petCanvas?.triggerJealousy();
        this.ctx.sound.playClick();
        break;
      }
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

    this.checkEvolution(prevBond);
    this.checkAchievements();

    // 럭키 드롭 (돌봄 액션 후 10% 확률)
    if (['feed', 'play', 'walk', 'clean', 'talk'].includes(action)) {
      this.processLuckyDrop();
    }

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

  private checkEvolution(prevBond: number): void {
    const pet = getActivePet(this.ctx.state.current);
    if (!pet) return;

    const prevStage = getGrowthStage(pet.type, prevBond);
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

  /** 질병 체크: 모든 펫에 대해 접속 시 실행 */
  private processSicknessCheck(): void {
    const state = this.ctx.state.current;
    const pets = state.pets.map(pet => {
      const checked = checkSickness(pet);
      const { pet: warned, warn } = checkRunawayWarning(checked);
      if (warn) {
        showToast(`⚠️ ${warned.name}이(가) 너무 오래 아팠어요! 가출 경고!`);
      }
      return warned;
    });
    this.ctx.state.current = { ...state, pets };
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
    const visitor = VISITORS.find(v => v.id === visitorId);
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
      alertEl.textContent = `${jealousPet.name}이(가) 질투하고 있어요!`;
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
