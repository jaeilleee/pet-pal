/**
 * HomeScene -- 메인 홈 화면 (Canvas 펫 렌더러 + 돌봄 액션)
 */

import type { Scene } from './SceneManager';
import type { AppContext } from '../app/AppContext';
import type { PetPalState } from '../data/state';
import type { SceneManager } from './SceneManager';
import { PETS, getGrowthStage } from '../data/pets';
import { decayStats, applyEffects, overallMood, moodEmoji } from '../data/state';
import { getItemById } from '../data/items';
import { processLogin, updateDailyProgress, allDailyTasksDone, getDailyRewardTotal } from '../data/daily';
import { getTimeOfDay, getTimeBackground } from '../data/time-guard';
import { COLORS } from '../data/design-tokens';
import { showToast } from '../ui/Toast';
import { PetCanvas } from '../game/PetCanvas';
import { checkNewAchievements, claimAchievements } from '../data/achievements';

type Ctx = AppContext<PetPalState, SceneManager>;

export class HomeScene implements Scene {
  private ctx: Ctx;
  private cleanups: Array<() => void> = [];
  private petCanvas: PetCanvas | null = null;

  constructor(ctx: Ctx) {
    this.ctx = ctx;
  }

  mount(root: HTMLElement): void {
    // 로그인 처리
    const loginResult = processLogin(this.ctx.state.current);
    this.ctx.state.current = loginResult.state;
    if (loginResult.reward > 0) {
      showToast(`출석 보상: ${loginResult.reward}G (${loginResult.chainDay}일차)`);
    }
    if (loginResult.streakMilestone) {
      showToast(`연속 ${this.ctx.state.current.streak}일 출석! +${loginResult.streakMilestone}G`);
    }

    // 스탯 감소 + 업적 체크
    this.ctx.state.current = decayStats(this.ctx.state.current);
    this.checkAchievements();
    this.ctx.save.save(this.ctx.state.current);

    const state = this.ctx.state.current;
    const pet = PETS[state.petType!];
    const stage = getGrowthStage(state.petType!, state.petStats.bond);
    const stageInfo = pet.stages[stage];
    const isSleeping = getTimeOfDay() === 'night' && state.petStats.energy < 30;

    root.innerHTML = `
      <div class="scene home-scene" style="background:${getTimeBackground()}">
        <div class="home-header">
          <div class="home-gold"><span class="gold-icon">💰</span><span id="gold-amount">${state.gold}</span>G</div>
          <div class="home-mood" id="mood-display">${moodEmoji(state.petStats)}</div>
          <button class="btn-icon" id="btn-achievements">🏆</button>
        </div>

        <div class="home-pet-area" id="pet-container"></div>

        <div class="pet-name-display">
          <span class="pet-name-label">${state.petName}</span>
          <span class="pet-stage-label">${stageInfo.name}</span>
        </div>

        <div class="stat-bars" id="stat-bars">${this.renderStatBars(state)}</div>

        <div class="bond-bar">
          <div class="bond-label">유대감 ${state.petStats.bond} / ${this.getNextThreshold(state)}</div>
          <div class="bond-track"><div class="bond-fill" style="width:${this.getBondPercent(state)}%"></div></div>
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

    // Canvas 펫 렌더러 설치
    const container = root.querySelector('#pet-container') as HTMLElement;
    this.petCanvas = new PetCanvas(container, state.petType!, stage, stageInfo.size);
    if (isSleeping) this.petCanvas.setEmotion('sleeping');
    this.petCanvas.setFurniture(state.ownedFurniture.map(id => getItemById(id)?.emoji ?? ''));
    if (state.equippedAccessory) {
      this.petCanvas.setAccessory(getItemById(state.equippedAccessory)?.emoji ?? null);
    }
    this.petCanvas.start();
    this.cleanups.push(() => this.petCanvas?.stop());

    this.bindActions(root);
    this.startAutoSave();
  }

  private renderStatBars(state: PetPalState): string {
    const stats = [
      { key: 'hunger', label: '배고픔', emoji: '🍖', color: COLORS.stat.hunger },
      { key: 'happiness', label: '행복', emoji: '😊', color: COLORS.stat.happiness },
      { key: 'cleanliness', label: '청결', emoji: '✨', color: COLORS.stat.cleanliness },
      { key: 'energy', label: '기력', emoji: '⚡', color: COLORS.stat.energy },
    ] as const;
    return stats.map(s => `
      <div class="stat-row">
        <span class="stat-emoji">${s.emoji}</span>
        <div class="stat-track"><div class="stat-fill" style="width:${state.petStats[s.key]}%;background:${s.color}"></div></div>
        <span class="stat-value">${Math.round(state.petStats[s.key])}</span>
      </div>
    `).join('');
  }

  private renderDailyStrip(state: PetPalState): string {
    if (!state.dailyTasks.length) return '';
    const done = allDailyTasksDone(state);
    return `
      <div class="daily-header">
        <span>📋 오늘의 할일</span>
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

  private getNextThreshold(state: PetPalState): number {
    const thresholds = PETS[state.petType!].evolutionThresholds;
    for (const t of thresholds) { if (state.petStats.bond < t) return t; }
    return state.petStats.bond;
  }

  private getBondPercent(state: PetPalState): number {
    const thresholds = [0, ...PETS[state.petType!].evolutionThresholds];
    const bond = state.petStats.bond;
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

    // Daily claim
    this.bindDailyClaim(root);

    // Achievements button
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
    const state = this.ctx.state.current;

    switch (action) {
      case 'feed':
        state.petStats = applyEffects(state.petStats, { hunger: 25, bond: 1 });
        state.totalFeeds++;
        this.ctx.state.current = updateDailyProgress(state, 'feed');
        this.petCanvas?.setEmotion('eating');
        this.petCanvas?.emitParticles('sparkle', 5);
        this.ctx.sound.playHarvest();
        break;
      case 'play':
        state.petStats = applyEffects(state.petStats, { happiness: 30, energy: -10, bond: 2 });
        state.totalPlays++;
        this.ctx.state.current = updateDailyProgress(state, 'play');
        this.petCanvas?.setEmotion('happy');
        this.petCanvas?.emitParticles('star', 6);
        this.ctx.sound.playLucky();
        break;
      case 'walk':
        state.petStats = applyEffects(state.petStats, { happiness: 20, energy: -15, cleanliness: -5, bond: 3 });
        state.totalWalks++;
        this.ctx.state.current = updateDailyProgress(state, 'walk');
        this.petCanvas?.setEmotion('happy');
        this.petCanvas?.emitParticles('leaf', 5);
        this.ctx.sound.playMerge();
        break;
      case 'clean':
        state.petStats = applyEffects(state.petStats, { cleanliness: 35, happiness: 5, bond: 1 });
        state.totalBaths++;
        this.ctx.state.current = updateDailyProgress(state, 'clean');
        this.petCanvas?.emitParticles('bubble', 8);
        this.ctx.sound.playWater();
        break;
      case 'talk':
        state.petStats = applyEffects(state.petStats, { happiness: 15, bond: 2 });
        state.totalTalks++;
        this.ctx.state.current = updateDailyProgress(state, 'talk');
        this.petCanvas?.setEmotion('love');
        this.petCanvas?.emitParticles('heart', 6);
        this.ctx.sound.playClick();
        break;
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

    this.checkEvolution(state);
    this.checkAchievements();
    this.ctx.save.save(this.ctx.state.current);
    this.refreshUI(root);
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
      import('./MiniGameScene').then(m => this.ctx.scenes.switchTo(() => new m.MiniGameScene(this.ctx)));
    });
    overlay.querySelector('[data-game="walk"]')?.addEventListener('click', () => {
      overlay.remove();
      import('./WalkGameScene').then(m => this.ctx.scenes.switchTo(() => new m.WalkGameScene(this.ctx)));
    });
    overlay.querySelector('.mg-close')?.addEventListener('click', () => overlay.remove());
  }

  private checkEvolution(state: PetPalState): void {
    const prevStage = getGrowthStage(state.petType!, state.petStats.bond - 3);
    const newStage = getGrowthStage(state.petType!, state.petStats.bond);
    if (prevStage !== newStage) {
      const pet = PETS[state.petType!];
      const info = pet.stages[newStage];
      showToast(`🎉 ${state.petName}이(가) ${info.name}(으)로 성장했어요!`);
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
        showToast(`🏆 ${ach.emoji} ${ach.name} +${ach.reward}G`);
      }
      this.petCanvas?.emitParticles('star', 8);
    }
  }

  private refreshUI(root: HTMLElement): void {
    const state = this.ctx.state.current;
    const statBars = root.querySelector('#stat-bars');
    if (statBars) statBars.innerHTML = this.renderStatBars(state);

    const goldEl = root.querySelector('#gold-amount');
    if (goldEl) goldEl.textContent = String(state.gold);

    const moodEl = root.querySelector('#mood-display');
    if (moodEl) moodEl.textContent = moodEmoji(state.petStats);

    const dailyStrip = root.querySelector('#daily-strip');
    if (dailyStrip) {
      dailyStrip.innerHTML = this.renderDailyStrip(state);
      this.bindDailyClaim(root);
    }

    const bondFill = root.querySelector('.bond-fill') as HTMLElement;
    const bondLabel = root.querySelector('.bond-label') as HTMLElement;
    if (bondFill) bondFill.style.width = `${this.getBondPercent(state)}%`;
    if (bondLabel) bondLabel.textContent = `유대감 ${state.petStats.bond} / ${this.getNextThreshold(state)}`;
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
