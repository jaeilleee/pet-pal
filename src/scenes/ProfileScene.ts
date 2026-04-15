/**
 * ProfileScene -- 펫 프로필 + 일기 + 통계
 */

import type { Scene } from './SceneManager';
import type { AppContext } from '../app/AppContext';
import type { SceneManager } from './SceneManager';
import { PETS, getGrowthStage, bondToNextStage, PET_SKILLS, getUnlockedSkills } from '../data/pets';
import type { PetType } from '../data/pets';
import { getActivePet, overallMood, moodEmoji, generateDiaryEntry, getActivePetTitle } from '../data/state';
import type { PetData, PetPalState } from '../data/state';
import { COLORS } from '../data/design-tokens';
import { createAnimState } from '../game/PetRenderer';
import { drawPetSprite } from '../game/PetSprite';
import { getLetterReply } from '../data/speeches';
import { showToast } from '../ui/Toast';

type Ctx = AppContext<PetPalState, SceneManager>;

export class ProfileScene implements Scene {
  private ctx: Ctx;
  private cleanups: Array<() => void> = [];

  constructor(ctx: Ctx) {
    this.ctx = ctx;
  }

  mount(root: HTMLElement): void {
    const state = this.ctx.state.current;
    const activePet = getActivePet(state);
    if (!activePet) return;

    const petDef = PETS[activePet.type];
    const stage = getGrowthStage(activePet.type, activePet.stats.bond);
    const stageInfo = petDef.stages[stage];
    const toNext = bondToNextStage(activePet.type, activePet.stats.bond);

    this.maybeGenerateDiary(state, activePet);

    root.innerHTML = `
      <div class="scene profile-scene">
        <div class="scene-header">
          <button class="btn-back" id="btn-back">←</button>
          <h2>프로필</h2>
        </div>

        <div class="profile-card">
          <div class="profile-pet" id="profile-pet-canvas"></div>
          <h3 class="profile-name">${activePet.name}</h3>
          <p class="profile-stage">${stageInfo.name} - ${stageInfo.description}</p>
          <p class="profile-mood">${moodEmoji(activePet.stats)} 기분: ${overallMood(activePet.stats)}점</p>
          ${toNext > 0 ? `<p class="profile-next">다음 진화까지 유대감 ${toNext} 필요</p>` : '<p class="profile-next">최종 진화 완료!</p>'}
        </div>

        <div class="profile-section">
          <h3>🌟 스킬</h3>
          ${this.renderSkills(activePet.type, activePet.stats.bond)}
        </div>

        <div class="profile-section">
          <h3>통계</h3>
          ${this.renderStats(state)}
        </div>

        <div class="profile-section">
          <h3>${activePet.name}의 일기</h3>
          ${this.renderDiary(state)}
        </div>

        <div class="profile-section">
          <h3>📊 이번 주 리포트</h3>
          ${this.renderWeeklyReport(state)}
        </div>

        <div class="profile-section profile-actions">
          <button class="btn-profile-action" id="btn-letter">💌 편지 쓰기</button>
          <button class="btn-profile-action" id="btn-visitor-book">📖 방문자 도감</button>
          <button class="btn-pet-card-share" id="btn-share-card">🔗 펫 카드 공유</button>
        </div>
      </div>
    `;

    this.drawProfilePet(root, activePet.type, stage, stageInfo.size);
    this.bindBack(root);
    this.bindLetter(root);
    this.bindVisitorBook(root);
    this.bindShareCard(root);
  }

  private maybeGenerateDiary(state: PetPalState, pet: import('../data/state').PetData): void {
    const today = new Date().toISOString().slice(0, 10);
    if (!state.diaryEntries.find(d => d.date === today)) {
      state.diaryEntries.push(generateDiaryEntry(pet));
      if (state.diaryEntries.length > 30) state.diaryEntries.shift();
      this.ctx.save.save(state);
    }
  }

  private renderSkills(petType: PetType, bond: number): string {
    const allSkills = PET_SKILLS[petType];
    const unlocked = getUnlockedSkills(petType, bond);
    const unlockedIds = new Set(unlocked.map(s => s.id));

    if (allSkills.length === 0) return '<p class="empty-text">스킬이 없어요</p>';

    return `<div class="skills-list">
      ${allSkills.map(skill => {
        const isUnlocked = unlockedIds.has(skill.id);
        return `<div class="skill-item ${isUnlocked ? 'unlocked' : 'locked'}">
          <span class="skill-emoji">${isUnlocked ? skill.emoji : '🔒'}</span>
          <div class="skill-info">
            <span class="skill-name">${isUnlocked ? skill.name : '???'}</span>
            <span class="skill-desc">${isUnlocked ? skill.description : `유대감 ${skill.bondRequired} 필요 (현재 ${bond})`}</span>
          </div>
          ${isUnlocked ? '<span class="skill-badge">활성</span>' : ''}
        </div>`;
      }).join('')}
    </div>`;
  }

  private renderStats(state: PetPalState): string {
    const activePet = getActivePet(state);
    return `
      <div class="stats-grid">
        <div class="stat-item"><span class="stat-num">${state.totalFeeds}</span><span>먹이</span></div>
        <div class="stat-item"><span class="stat-num">${state.totalPlays}</span><span>놀기</span></div>
        <div class="stat-item"><span class="stat-num">${state.totalWalks}</span><span>산책</span></div>
        <div class="stat-item"><span class="stat-num">${state.totalBaths}</span><span>씻기</span></div>
        <div class="stat-item"><span class="stat-num">${state.totalTalks}</span><span>대화</span></div>
        <div class="stat-item"><span class="stat-num">${state.totalMiniGamesPlayed}</span><span>게임</span></div>
      </div>
      <div class="stats-extra">
        <p>총 획득 골드: ${state.totalGoldEarned}G</p>
        <p>미니게임 최고: ${state.miniGameHighScore}점</p>
        <p>연속 출석: ${state.streak}일 (최고: ${state.bestStreak}일)</p>
        <p>유대감: ${activePet?.stats.bond ?? 0}</p>
      </div>
    `;
  }

  private renderDiary(state: PetPalState): string {
    if (state.diaryEntries.length === 0) {
      return '<p class="empty-text">아직 일기가 없어요</p>';
    }
    return `<div class="diary-list">
      ${state.diaryEntries.slice(-7).reverse().map(d => `
        <div class="diary-entry">
          <span class="diary-date">${d.date}</span>
          <span class="diary-emoji">${d.emoji}</span>
          <span class="diary-text">${d.text}</span>
          ${d.petName ? `<span class="diary-pet">${d.petName}</span>` : ''}
        </div>
      `).join('')}
    </div>`;
  }

  private drawProfilePet(
    root: HTMLElement,
    petType: import('../data/pets').PetType,
    stage: import('../data/pets').GrowthStage,
    size: number,
  ): void {
    const container = root.querySelector('#profile-pet-canvas') as HTMLElement;
    if (!container) return;

    const cvs = document.createElement('canvas');
    const cSize = 120;
    cvs.width = cSize * 2; cvs.height = cSize * 2;
    cvs.style.width = `${cSize}px`; cvs.style.height = `${cSize}px`;
    cvs.style.display = 'block'; cvs.style.margin = '0 auto 8px';
    container.appendChild(cvs);
    const pctx = cvs.getContext('2d');
    if (pctx) {
      pctx.scale(2, 2);
      const anim = createAnimState();
      anim.emotion = 'happy';
      drawPetSprite(pctx, petType, stage, cSize / 2, cSize / 2 + 5, size * 0.8);
    }
  }

  /** 주간 책임감 리포트 렌더 */
  private renderWeeklyReport(state: PetPalState): string {
    const activePet = getActivePet(state);
    if (!activePet) return '<p class="empty-text">펫이 없어요</p>';

    // 출석 일수 (현재 streak 기반)
    const attendanceDays = Math.min(state.streak, 7);

    // 총 돌봄 횟수
    const totalCare = state.totalFeeds + state.totalPlays + state.totalWalks + state.totalBaths + state.totalTalks;

    // 현재 기분
    const mood = overallMood(activePet.stats);

    // 별점 계산 (1~5)
    let stars = 1;
    if (attendanceDays >= 6 && mood >= 70 && totalCare >= 30) stars = 5;
    else if (attendanceDays >= 4 && mood >= 60 && totalCare >= 20) stars = 4;
    else if (attendanceDays >= 3 && mood >= 50 && totalCare >= 10) stars = 3;
    else if (attendanceDays >= 2 && mood >= 40) stars = 2;

    const starDisplay = '⭐'.repeat(stars) + '☆'.repeat(5 - stars);

    // 평가 메시지
    let evalMessage = '위험해요!';
    if (stars >= 4) evalMessage = '훌륭해요!';
    else if (stars >= 3) evalMessage = '잘하고 있어요!';
    else if (stars >= 2) evalMessage = '좀 더 노력해요';

    return `
      <div class="weekly-report">
        <div class="weekly-report-row"><span>📅 출석 일수</span><span>${attendanceDays}일 / 7일</span></div>
        <div class="weekly-report-row"><span>🤲 총 돌봄 횟수</span><span>${totalCare}회</span></div>
        <div class="weekly-report-row"><span>${moodEmoji(activePet.stats)} 펫 기분</span><span>${mood}점</span></div>
        <div class="weekly-report-stars">
          <span class="report-stars">${starDisplay}</span>
          <span class="report-eval">${evalMessage}</span>
        </div>
      </div>
    `;
  }

  /** 편지 쓰기 모달 */
  private bindLetter(root: HTMLElement): void {
    const btn = root.querySelector('#btn-letter');
    if (!btn) return;
    const handler = (): void => {
      this.ctx.sound.playClick();
      this.showLetterModal(root);
    };
    btn.addEventListener('click', handler);
    this.cleanups.push(() => btn.removeEventListener('click', handler));
  }

  private showLetterModal(root: HTMLElement): void {
    const activePet = getActivePet(this.ctx.state.current);
    if (!activePet) return;

    const overlay = document.createElement('div');
    overlay.className = 'mg-picker-overlay';
    overlay.innerHTML = `
      <div class="letter-modal">
        <h3>💌 ${activePet.name}에게 편지 쓰기</h3>
        <textarea class="letter-textarea" id="letter-input" maxlength="50" placeholder="마음을 전해보세요... (50자)" rows="3"></textarea>
        <div class="letter-char-count"><span id="letter-count">0</span>/50</div>
        <div class="letter-actions">
          <button class="btn-primary btn-small" id="btn-send-letter">보내기</button>
          <button class="btn-secondary btn-small" id="btn-cancel-letter">취소</button>
        </div>
        <div id="letter-reply" class="letter-reply" style="display:none"></div>
      </div>
    `;
    root.appendChild(overlay);

    const input = overlay.querySelector('#letter-input') as HTMLTextAreaElement;
    const countEl = overlay.querySelector('#letter-count') as HTMLElement;

    // 글자 수 카운트
    const inputHandler = (): void => {
      countEl.textContent = String(input.value.length);
    };
    input.addEventListener('input', inputHandler);

    // 보내기
    const sendBtn = overlay.querySelector('#btn-send-letter') as HTMLElement;
    sendBtn.addEventListener('click', () => {
      const text = input.value.trim();
      if (!text) {
        showToast('편지를 써주세요!');
        return;
      }

      this.ctx.sound.playClick();
      input.disabled = true;
      sendBtn.style.display = 'none';

      // 1초 후 답장 표시
      setTimeout(() => {
        const reply = getLetterReply(activePet.personality);
        const replyEl = overlay.querySelector('#letter-reply') as HTMLElement;
        replyEl.style.display = 'block';
        replyEl.innerHTML = `
          <div class="letter-reply-header">💕 ${activePet.name}의 답장</div>
          <div class="letter-reply-text">"${reply}"</div>
        `;

        // 일기에 기록
        const state = this.ctx.state.current;
        const today = new Date().toISOString().slice(0, 10);
        const diaryEntries = [
          ...state.diaryEntries,
          { date: today, emoji: '💌', text: `편지: "${text}"`, petName: activePet.name },
          { date: today, emoji: '💕', text: `답장: "${reply}"`, petName: activePet.name },
        ].slice(-50);
        this.ctx.state.current = { ...state, diaryEntries };
        this.ctx.save.save(this.ctx.state.current);

        showToast('💌 편지를 보냈어요!');
      }, 1000);
    });

    // 취소
    overlay.querySelector('#btn-cancel-letter')?.addEventListener('click', () => {
      overlay.remove();
    });

    // 배경 클릭 닫기 (답장 표시 중에만)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  private bindVisitorBook(root: HTMLElement): void {
    const btn = root.querySelector('#btn-visitor-book');
    if (!btn) return;
    const handler = (): void => {
      this.ctx.sound.playClick();
      import('./VisitorBookScene').then(m => {
        this.ctx.scenes.switchTo(() => new m.VisitorBookScene(this.ctx));
      }).catch(err => console.error('[ProfileScene] VisitorBook load failed', err));
    };
    btn.addEventListener('click', handler);
    this.cleanups.push(() => btn.removeEventListener('click', handler));
  }

  /** 펫 카드 공유 */
  private bindShareCard(root: HTMLElement): void {
    const btn = root.querySelector('#btn-share-card');
    if (!btn) return;
    const handler = (): void => {
      this.ctx.sound.playClick();
      this.generateAndSharePetCard();
    };
    btn.addEventListener('click', handler);
    this.cleanups.push(() => btn.removeEventListener('click', handler));
  }

  /** Canvas로 펫 카드 생성 (300x400) → share or download */
  private generateAndSharePetCard(): void {
    const state = this.ctx.state.current;
    const pet = getActivePet(state);
    if (!pet) return;

    const petDef = PETS[pet.type];
    const stage = getGrowthStage(pet.type, pet.stats.bond);
    const stageInfo = petDef.stages[stage];
    const title = this.getShareTitle(pet, state);
    const mood = overallMood(pet.stats);

    const W = 300;
    const H = 400;
    const cvs = document.createElement('canvas');
    cvs.width = W * 2;
    cvs.height = H * 2;
    const c = cvs.getContext('2d');
    if (!c) return;
    c.scale(2, 2);

    // 배경 그라데이션
    const grad = c.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#FFF3E0');
    grad.addColorStop(1, '#E8F4FD');
    c.fillStyle = grad;
    c.fillRect(0, 0, W, H);

    // 카드 프레임 (둥근 테두리)
    c.strokeStyle = 'rgba(224,96,64,0.2)';
    c.lineWidth = 3;
    c.beginPath();
    c.roundRect(8, 8, W - 16, H - 16, 16);
    c.stroke();

    // 바닥
    c.fillStyle = '#D7CCC8';
    c.fillRect(0, H * 0.6, W, H * 0.4);

    // 펫 렌더
    drawPetSprite(c, pet.type, stage, W / 2, H * 0.38, stageInfo.size * 1.3);

    // 이름
    c.fillStyle = '#352820';
    c.font = 'bold 22px Nunito, Pretendard, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(pet.name, W / 2, H * 0.68);

    // 칭호
    c.fillStyle = '#786860';
    c.font = '13px Nunito, Pretendard, sans-serif';
    c.fillText(`${title} ${stageInfo.name}`, W / 2, H * 0.73);

    // 스탯 바
    const stats = [
      { label: '🍖', val: pet.stats.hunger, color: '#e06040' },
      { label: '😊', val: pet.stats.happiness, color: '#f0c840' },
      { label: '✨', val: pet.stats.cleanliness, color: '#68a8d8' },
      { label: '⚡', val: pet.stats.energy, color: '#48b870' },
    ];
    const barY = H * 0.79;
    const barW = 180;
    const barH = 8;
    const barX = (W - barW) / 2;
    stats.forEach((s, i) => {
      const y = barY + i * 18;
      c.font = '12px sans-serif';
      c.textAlign = 'left';
      c.fillStyle = '#352820';
      c.fillText(s.label, barX - 20, y + barH / 2);
      // track
      c.fillStyle = 'rgba(0,0,0,0.08)';
      c.beginPath();
      c.roundRect(barX, y, barW, barH, 4);
      c.fill();
      // fill
      c.fillStyle = s.color;
      c.beginPath();
      c.roundRect(barX, y, barW * (s.val / 100), barH, 4);
      c.fill();
    });

    // 기분 + 유대감
    c.fillStyle = '#786860';
    c.font = '11px Nunito, Pretendard, sans-serif';
    c.textAlign = 'center';
    c.fillText(`${moodEmoji(pet.stats)} 기분 ${mood}점  |  유대감 ${pet.stats.bond}`, W / 2, H * 0.96);

    // 워터마크
    c.fillStyle = 'rgba(0,0,0,0.15)';
    c.font = '9px sans-serif';
    c.fillText('PetPal', W / 2, H - 8);

    const dataUrl = cvs.toDataURL('image/png');
    this.sharePetCard(dataUrl);
  }

  private getShareTitle(pet: PetData, state: PetPalState): string {
    try {
      return getActivePetTitle(pet, state);
    } catch {
      return '';
    }
  }

  private sharePetCard(dataUrl: string): void {
    if (navigator.share && navigator.canShare) {
      fetch(dataUrl)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], 'petpal-card.png', { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            navigator.share({ title: 'PetPal 펫 카드', text: '내 펫을 소개합니다!', files: [file] })
              .catch((err: unknown) => {
                if (err instanceof Error && err.name !== 'AbortError') {
                  this.downloadPetCard(dataUrl);
                }
              });
          } else {
            this.downloadPetCard(dataUrl);
          }
        })
        .catch(() => this.downloadPetCard(dataUrl));
    } else {
      this.downloadPetCard(dataUrl);
    }
  }

  private downloadPetCard(dataUrl: string): void {
    const link = document.createElement('a');
    link.download = `petpal-card-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
    showToast('📸 펫 카드가 저장되었어요!');
  }

  private bindBack(root: HTMLElement): void {
    const backBtn = root.querySelector('#btn-back') as HTMLElement;
    const handler = (): void => {
      this.ctx.sound.playClick();
      import('./HomeScene').then(m => {
        this.ctx.scenes.switchTo(() => new m.HomeScene(this.ctx));
      }).catch(err => console.error('[ProfileScene] load failed', err));
    };
    backBtn.addEventListener('click', handler);
    this.cleanups.push(() => backBtn.removeEventListener('click', handler));
  }

  unmount(): void {
    this.cleanups.forEach(fn => fn());
    this.cleanups = [];
  }
}
