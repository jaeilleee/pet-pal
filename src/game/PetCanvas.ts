/**
 * PetCanvas -- 인터랙티브 멀티펫 Canvas (최대 3마리)
 * 각 펫이 독립적으로 걸어다니고, 클릭 반응, 질투 표현
 */

import type { PetType, GrowthStage } from '../data/pets';
import type { PetStats, PetData } from '../data/state';
import { getGrowthStage, PETS } from '../data/pets';
import { drawPet, createAnimState, updateAnimState, type PetAnimState } from './PetRenderer';
import { ParticleSystem, type ParticleType } from './Particles';
import { getTimeOfDay } from '../data/time-guard';
import { getPersonalitySpeech, getSpeechFromCategory } from '../data/speeches';
import type { Personality } from '../data/pets';

/** 말풍선 콜백 */
export type SpeechCallback = (text: string) => void;

/** Canvas 내부 펫 상태 */
interface CanvasPet {
  type: PetType;
  stage: GrowthStage;
  size: number;
  anim: PetAnimState;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  isMoving: boolean;
  facingLeft: boolean;
  jealousy: number;
  name: string;
  personality: Personality;
  speechText: string;
  speechAlpha: number;
  speechTimer: number;
  idleEmotionTimer: number;
  stats: PetStats | null;
  accessory: string | null;
  /** 이동 도착 시 바운스 오프셋 */
  bounceOffset: number;
  /** 바운스 진행 중 여부 */
  isBouncing: boolean;
  /** 바운스 타이머 */
  bounceTimer: number;
  /** 상호작용 쿨다운 */
  interactionCooldown: number;
  /** 다른 펫을 따라가는 중인지 */
  followingPetIndex: number;
  /** 아픈 상태 */
  isSick: boolean;
  /** 색상 변형 ID */
  colorVariant: string;
}

export class PetCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: ParticleSystem;
  private frameId = 0;
  private lastTime = 0;
  private W: number;
  private H: number;
  private furniture: string[] = [];
  private season: 'spring' | 'summer' | 'autumn' | 'winter' = 'spring';
  private ambientTimer = 0;
  private moveSpeed = 80;
  private onSpeech: SpeechCallback | null = null;
  private onPetSelected: ((index: number) => void) | null = null;

  private pets: CanvasPet[] = [];
  private activePetIndex = 0;
  private visitorEmoji: string | null = null;
  private visitorBounceTime = 0;
  private tearTimer = 0;
  private expeditionPetIndices: number[] = [];
  private roomTheme: string | null = null;
  /** 이모티콘 풍선 */
  private emoticonEmoji: string | null = null;
  private emoticonTimer = 0;
  private emoticonScale = 0;
  private emoticonAlpha = 1;

  constructor(container: HTMLElement) {
    this.particles = new ParticleSystem();
    this.season = this.getCurrentSeason();

    this.W = Math.min(container.clientWidth || 350, 390);
    this.H = Math.min(container.clientHeight || 180, 180);

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.W * 2;
    this.canvas.height = this.H * 2;
    this.canvas.style.width = `${this.W}px`;
    this.canvas.style.height = `${this.H}px`;
    this.canvas.className = 'pet-canvas';
    container.appendChild(this.canvas);

    const ctx2d = this.canvas.getContext('2d');
    if (!ctx2d) throw new Error('PetCanvas: 2d context unavailable');
    this.ctx = ctx2d;
    this.ctx.scale(2, 2);

    this.canvas.addEventListener('click', (e) => this.handleClick(e));
  }

  /** PetData 배열로 Canvas 내부 상태 동기화 */
  setPets(petDataList: PetData[]): void {
    const positions = this.getInitialPositions(petDataList.length);

    // 기존 펫 업데이트 또는 새 펫 추가
    const newPets: CanvasPet[] = petDataList.map((pd, i) => {
      const existing = this.pets[i];
      const stage = getGrowthStage(pd.type, pd.stats.bond);
      const stageInfo = PETS[pd.type].stages[stage];
      const pos = positions[i];

      if (existing && existing.type === pd.type) {
        // 기존 펫 유지, 데이터만 갱신
        existing.stage = stage;
        existing.size = stageInfo.size;
        existing.jealousy = pd.jealousy;
        existing.name = pd.name;
        existing.personality = pd.personality;
        existing.stats = pd.stats;
        existing.isSick = pd.isSick;
        return existing;
      }

      return this.createCanvasPet(pd, stage, stageInfo.size, pos.x, pos.y);
    });

    this.pets = newPets;
  }

  setActivePet(index: number): void {
    this.activePetIndex = index;
  }

  private createCanvasPet(
    pd: PetData, stage: GrowthStage, size: number, x: number, y: number,
  ): CanvasPet {
    return {
      type: pd.type,
      stage,
      size,
      anim: createAnimState(),
      x, y,
      targetX: x, targetY: y,
      isMoving: false,
      facingLeft: false,
      jealousy: pd.jealousy,
      name: pd.name,
      personality: pd.personality,
      speechText: '',
      speechAlpha: 0,
      speechTimer: 0,
      idleEmotionTimer: 5 + Math.random() * 10,
      stats: pd.stats,
      accessory: pd.equippedAccessory,
      bounceOffset: 0,
      isBouncing: false,
      bounceTimer: 0,
      interactionCooldown: 0,
      followingPetIndex: -1,
      isSick: pd.isSick,
      colorVariant: pd.colorVariant ?? 'default',
    };
  }

  private getInitialPositions(count: number): Array<{ x: number; y: number }> {
    const y = this.H * 0.55;
    if (count === 1) return [{ x: this.W / 2, y }];
    if (count === 2) return [{ x: this.W * 0.3, y }, { x: this.W * 0.7, y }];
    return [{ x: this.W * 0.2, y }, { x: this.W * 0.5, y }, { x: this.W * 0.8, y }];
  }

  private handleClick(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // 펫 영역 판정: 가장 가까운 펫 찾기
    const closest = this.findClosestPet(clickX, clickY);
    if (closest) {
      // 클릭한 펫이 활성 펫과 다르면 펫 전환
      const clickedIndex = this.pets.indexOf(closest);
      if (clickedIndex !== -1 && clickedIndex !== this.activePetIndex) {
        this.activePetIndex = clickedIndex;
        this.onPetSelected?.(clickedIndex);
      }
      this.handlePetTouch(closest, clickX, clickY);
      return;
    }

    // 바닥 클릭 -> 활성 펫만 이동
    const activePet = this.pets[this.activePetIndex];
    if (!activePet) return;
    this.movePetTo(activePet, clickX, clickY);
  }

  private findClosestPet(x: number, y: number): CanvasPet | null {
    let best: CanvasPet | null = null;
    let bestDist = Infinity;

    for (const pet of this.pets) {
      const dx = x - pet.x;
      const dy = y - pet.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const hitRadius = pet.size * 0.5;
      if (dist < hitRadius && dist < bestDist) {
        best = pet;
        bestDist = dist;
      }
    }
    return best;
  }

  private movePetTo(pet: CanvasPet, clickX: number, clickY: number): void {
    const floorY = this.H * 0.78;
    const clampedY = Math.min(clickY, floorY - 10);
    const clampedX = Math.max(30, Math.min(this.W - 30, clickX));
    pet.targetX = clampedX;
    pet.targetY = Math.max(this.H * 0.35, clampedY);
    pet.isMoving = true;
    pet.facingLeft = pet.targetX < pet.x;
    this.particles.emit(pet.x, pet.y + 15, 'sparkle', 2);
  }

  private handlePetTouch(pet: CanvasPet, x: number, y: number): void {
    const headY = pet.y - pet.size * 0.25;

    if (y < headY) {
      this.setPetEmotion(pet, 'love');
      this.showPetSpeech(pet, '기분 좋아~!');
      this.particles.emit(x, y, 'heart', 5);
    } else if (y > pet.y + pet.size * 0.15) {
      this.setPetEmotion(pet, 'happy');
      this.showPetSpeech(pet, '간지러워!');
      this.particles.emit(x, y, 'star', 4);
    } else {
      this.setPetEmotion(pet, 'love');
      this.showPetSpeech(pet, '따뜻해~!');
      this.particles.emit(x, y, 'heart', 3);
      this.particles.emit(x, y, 'sparkle', 3);
    }
  }

  start(): void {
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  stop(): void {
    cancelAnimationFrame(this.frameId);
  }

  /** 활성 펫의 감정 설정 */
  setEmotion(emotion: PetAnimState['emotion']): void {
    const pet = this.pets[this.activePetIndex];
    if (pet) this.setPetEmotion(pet, emotion);
  }

  private setPetEmotion(pet: CanvasPet, emotion: PetAnimState['emotion']): void {
    pet.anim.emotion = emotion;
    setTimeout(() => {
      if (pet.anim.emotion === emotion) pet.anim.emotion = 'neutral';
    }, 2500);
  }

  /** 활성 펫에 말풍선 표시 */
  showSpeech(text: string): void {
    const pet = this.pets[this.activePetIndex];
    if (pet) this.showPetSpeech(pet, text);
  }

  private showPetSpeech(pet: CanvasPet, text: string): void {
    pet.speechText = text;
    pet.speechAlpha = 1;
    pet.speechTimer = 2.5;
    this.onSpeech?.(text);
  }

  emitParticles(type: ParticleType, count: number = 5): void {
    const pet = this.pets[this.activePetIndex];
    if (pet) this.particles.emit(pet.x, pet.y - 10, type, count);
  }

  updatePet(stage: GrowthStage, size: number): void {
    const pet = this.pets[this.activePetIndex];
    if (pet) { pet.stage = stage; pet.size = size; }
  }

  setStats(stats: PetStats): void {
    const pet = this.pets[this.activePetIndex];
    if (pet) pet.stats = stats;
  }

  setSpeechCallback(cb: SpeechCallback): void {
    this.onSpeech = cb;
  }

  setPetSelectedCallback(cb: (index: number) => void): void {
    this.onPetSelected = cb;
  }

  setRoomTheme(theme: string | null): void {
    this.roomTheme = theme;
  }

  /** 활성 펫 위에 큰 이모지(50px) 바운스 표시 후 페이드아웃 */
  showEmoticon(emoji: string): void {
    this.emoticonEmoji = emoji;
    this.emoticonTimer = 1.5;
    this.emoticonScale = 0;
    this.emoticonAlpha = 1;
  }

  setFurniture(items: string[]): void {
    this.furniture = items;
  }

  setAccessory(acc: string | null): void {
    const pet = this.pets[this.activePetIndex];
    if (pet) pet.accessory = acc;
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /** 사진 캡처: 현재 프레임을 고해상도 PNG로 반환 */
  capturePhoto(): string {
    return this.canvas.toDataURL('image/png');
  }

  /** 포토 모드용 포즈 설정 */
  setPhotoPose(pose: 'happy' | 'love' | 'sleeping'): void {
    const pet = this.pets[this.activePetIndex];
    if (!pet) return;
    this.setPetEmotion(pet, pose === 'love' ? 'love' : pose === 'sleeping' ? 'sleeping' : 'happy');
  }

  /** 플래시 효과 */
  flashEffect(): void {
    const c = this.ctx;
    c.save();
    c.fillStyle = 'rgba(255,255,255,0.8)';
    c.fillRect(0, 0, this.W, this.H);
    c.restore();
    // 0.2초 후 자동 해제 (다음 프레임에서 덮어씌워짐)
  }

  /** 탐험 중인 펫 인덱스 목록 설정 */
  setExpeditionPets(indices: number[]): void {
    this.expeditionPetIndices = indices;
  }

  /** 방문자 이모지 설정 (null이면 숨김) */
  setVisitor(emoji: string | null): void {
    this.visitorEmoji = emoji;
    this.visitorBounceTime = 0;
  }

  /** 질투 반응 트리거 (활성 펫에 액션 시 호출) */
  triggerJealousy(): void {
    for (let i = 0; i < this.pets.length; i++) {
      if (i === this.activePetIndex) continue;
      const pet = this.pets[i];
      this.applyJealousyReaction(pet);
    }
  }

  private applyJealousyReaction(pet: CanvasPet): void {
    if (pet.jealousy > 80) {
      this.showPetSpeech(pet, '나도 놀아줘!');
      this.setPetEmotion(pet, 'love'); // angry not in union, use neutral after
      pet.anim.emotion = 'neutral'; // override: sulking
      pet.facingLeft = !pet.facingLeft;
    } else if (pet.jealousy > 60) {
      pet.anim.emotion = 'neutral';
      pet.facingLeft = !pet.facingLeft;
    } else if (pet.jealousy > 30) {
      pet.facingLeft = !pet.facingLeft;
    }
  }

  private loop = (time: number): void => {
    const dt = Math.min((time - this.lastTime) / 1000, 0.05);
    this.lastTime = time;

    for (const pet of this.pets) {
      updateAnimState(pet.anim, dt);
      this.updatePetMovement(pet, dt);
      this.updatePetIdleEmotion(pet, dt);
      this.updatePetSpeech(pet, dt);
      // 상호작용 쿨다운 감소
      if (pet.interactionCooldown > 0) {
        pet.interactionCooldown -= dt;
      }
    }

    // 방문자 바운스 타이머
    if (this.visitorEmoji) {
      this.visitorBounceTime += dt;
    }

    // 이모티콘 풍선 타이머
    if (this.emoticonTimer > 0) {
      this.emoticonTimer -= dt;
      // 처음 0.3초: 바운스 스케일 업
      if (this.emoticonTimer > 1.2) {
        this.emoticonScale = Math.min(1, this.emoticonScale + dt * 5);
      }
      // 마지막 0.4초: 페이드아웃
      if (this.emoticonTimer < 0.4) {
        this.emoticonAlpha = Math.max(0, this.emoticonTimer / 0.4);
      }
      if (this.emoticonTimer <= 0) {
        this.emoticonEmoji = null;
      }
    }

    // 눈물 타이머 (happiness < 15)
    this.tearTimer -= dt;
    const activePet = this.pets[this.activePetIndex];
    if (activePet?.stats && activePet.stats.happiness < 15 && this.tearTimer <= 0) {
      this.tearTimer = 2;
      this.particles.emit(activePet.x, activePet.y - activePet.size * 0.2, 'bubble', 2);
    }

    // 펫 간 상호작용 체크
    this.updatePetInteractions(dt);

    this.particles.update(dt);

    this.ambientTimer -= dt;
    if (this.ambientTimer <= 0) {
      this.ambientTimer = 1.0 + Math.random() * 0.8;
      this.emitAmbientParticle();
    }

    this.render();
    this.frameId = requestAnimationFrame(this.loop);
  };

  private updatePetMovement(pet: CanvasPet, dt: number): void {
    // 바운스 애니메이션 처리
    if (pet.isBouncing) {
      pet.bounceTimer -= dt;
      if (pet.bounceTimer <= 0) {
        pet.isBouncing = false;
        pet.bounceOffset = 0;
      } else {
        // 감쇄 바운스: 2px 오버슈트 → 복귀
        pet.bounceOffset = Math.sin(pet.bounceTimer * 12) * 2 * (pet.bounceTimer / 0.3);
      }
    }

    if (!pet.isMoving) return;
    const dx = pet.targetX - pet.x;
    const dy = pet.targetY - pet.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 3) {
      pet.x = pet.targetX;
      pet.y = pet.targetY;
      pet.isMoving = false;
      // 도착 시 바운스 시작
      pet.isBouncing = true;
      pet.bounceTimer = 0.3;
      return;
    }

    // Ease-out: 목표에 가까울수록 느려짐
    const easeFactor = Math.min(1, dist / 60);
    const speed = this.moveSpeed * (0.3 + 0.7 * easeFactor);
    const step = speed * dt;
    pet.x += (dx / dist) * step;
    pet.y += (dy / dist) * step;
    pet.facingLeft = dx < 0;
  }

  private updatePetIdleEmotion(pet: CanvasPet, dt: number): void {
    if (!pet.stats) return;
    pet.idleEmotionTimer -= dt;
    if (pet.idleEmotionTimer > 0) return;
    pet.idleEmotionTimer = 8 + Math.random() * 12;

    if (pet.anim.emotion !== 'neutral') return;

    const s = pet.stats;
    if (s.hunger < 25) {
      this.showPetSpeech(pet, getPersonalitySpeech(pet.personality, s));
      this.setPetEmotion(pet, 'eating');
    } else if (s.happiness < 25) {
      this.showPetSpeech(pet, getSpeechFromCategory(pet.personality, 'bored'));
    } else if (s.cleanliness < 25) {
      this.showPetSpeech(pet, getPersonalitySpeech(pet.personality, s));
    } else if (s.energy < 20) {
      this.showPetSpeech(pet, getSpeechFromCategory(pet.personality, 'tired'));
      this.setPetEmotion(pet, 'sleeping');
    } else if (s.happiness > 80 && Math.random() < 0.5) {
      this.showPetSpeech(pet, getSpeechFromCategory(pet.personality, 'happy'));
      this.setPetEmotion(pet, 'happy');
      // 펫 타입별 고유 행동
      this.triggerPetTypeBehavior(pet);
    } else if (Math.random() < 0.3) {
      // 펫 타입별 idle 행동 (중립 상태에서도 가끔)
      if (Math.random() < 0.4) {
        this.triggerPetTypeBehavior(pet);
      } else {
        this.startRandomWalk(pet);
      }
    }
  }

  /** 펫 타입별 고유 idle 행동 트리거 */
  private triggerPetTypeBehavior(pet: CanvasPet): void {
    switch (pet.type) {
      case 'dog':
        if (pet.stats && pet.stats.happiness > 70) {
          // 꼬리 흔들기 진폭 2배는 renderSinglePet에서 처리
          if (Math.random() < 0.3) {
            // 가끔 점프
            pet.anim.customAction = 'jumping';
            pet.anim.customActionTimer = 1.5;
          }
        }
        break;
      case 'cat':
        if (Math.random() < 0.3) {
          // 그루밍 모션
          pet.anim.customAction = 'grooming';
          pet.anim.customActionTimer = 3;
        } else if (Math.random() < 0.3) {
          // 기지개
          pet.anim.customAction = 'stretch';
          pet.anim.customActionTimer = 2;
        }
        break;
      case 'bird':
        // 날개짓 빈도는 happiness에 비례 (drawFeatures에서 wingFlap 사용)
        // 여기서는 추가 파티클로 표현
        if (pet.stats && pet.stats.happiness > 60) {
          this.particles.emit(pet.x, pet.y - 10, 'sparkle', 2);
        }
        break;
      case 'pig':
        if (pet.stats && pet.stats.hunger < 50) {
          // 코로 바닥 킁킁
          pet.anim.customAction = 'sniffing';
          pet.anim.customActionTimer = 2.5;
        }
        break;
      case 'reptile':
        // 일광욕 자세: 가만히 + 가끔 혀 날름
        if (Math.random() < 0.4) {
          pet.anim.customAction = 'tongue';
          pet.anim.customActionTimer = 2;
        }
        break;
    }
  }

  private startRandomWalk(pet: CanvasPet): void {
    pet.targetX = 40 + Math.random() * (this.W - 80);
    pet.targetY = this.H * 0.4 + Math.random() * (this.H * 0.3);
    pet.isMoving = true;
    pet.facingLeft = pet.targetX < pet.x;
  }

  private updatePetSpeech(pet: CanvasPet, dt: number): void {
    if (pet.speechTimer > 0) {
      pet.speechTimer -= dt;
      if (pet.speechTimer <= 0.5) {
        pet.speechAlpha = Math.max(0, pet.speechTimer / 0.5);
      }
    }
  }

  private render(): void {
    const c = this.ctx;
    c.clearRect(0, 0, this.W, this.H);

    this.drawBackground(c);
    this.drawFloor(c);
    this.drawFurniture(c);

    // 모든 펫 렌더 (y 순서로 정렬해서 깊이감, 탐험 중 펫 제외)
    const sorted = this.pets
      .map((pet, i) => ({ pet, index: i }))
      .filter(({ index }) => !this.expeditionPetIndices.includes(index))
      .sort((a, b) => a.pet.y - b.pet.y);

    for (const { pet, index } of sorted) {
      this.renderSinglePet(c, pet, index === this.activePetIndex);
    }

    // 이모티콘 풍선 렌더
    this.drawEmoticon(c);

    // 극단적 스탯 배경 오버레이
    this.drawStatOverlay(c);

    // 방문자 렌더
    this.drawVisitor(c);

    this.particles.render(c);
  }

  /** 스탯 합계에 따른 배경 오버레이 */
  private drawStatOverlay(c: CanvasRenderingContext2D): void {
    const pet = this.pets[this.activePetIndex];
    if (!pet?.stats) return;
    const total = pet.stats.hunger + pet.stats.happiness + pet.stats.cleanliness + pet.stats.energy;

    if (total < 100) {
      // 어두운 오버레이
      c.fillStyle = 'rgba(0,0,0,0.10)';
      c.fillRect(0, 0, this.W, this.H);
    } else if (total > 320) {
      // 가끔 무지개 파티클
      if (Math.random() < 0.02) {
        const rx = Math.random() * this.W;
        const ry = Math.random() * this.H * 0.5;
        this.particles.emit(rx, ry, 'sparkle', 1);
      }
    }
  }

  /** 방문자 렌더링 (우하단, 위아래 바운스) */
  private drawVisitor(c: CanvasRenderingContext2D): void {
    if (!this.visitorEmoji) return;
    const vx = this.W - 40;
    const vy = this.H * 0.65 + Math.sin(this.visitorBounceTime * 2.5) * 4;
    c.font = '22px Apple Color Emoji, Segoe UI Emoji';
    c.textAlign = 'center';
    c.fillText(this.visitorEmoji, vx, vy);
  }

  /** 이모티콘 풍선 (활성 펫 위에 큰 이모지 바운스) */
  private drawEmoticon(c: CanvasRenderingContext2D): void {
    if (!this.emoticonEmoji || this.emoticonTimer <= 0) return;
    const pet = this.pets[this.activePetIndex];
    if (!pet) return;

    const baseY = pet.y - pet.size * 0.6 - 20;
    // 바운스 효과: sine wave
    const bounce = Math.sin(this.emoticonTimer * 8) * 5 * this.emoticonScale;
    const ey = baseY - bounce;

    c.save();
    c.globalAlpha = this.emoticonAlpha;
    const scale = 0.5 + this.emoticonScale * 0.5; // 0.5 -> 1.0
    c.translate(pet.x, ey);
    c.scale(scale, scale);
    c.font = '50px Apple Color Emoji, Segoe UI Emoji';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(this.emoticonEmoji, 0, 0);
    c.restore();
  }

  private renderSinglePet(
    c: CanvasRenderingContext2D, pet: CanvasPet, isActive: boolean,
  ): void {
    // 강아지 happiness > 70이면 꼬리 흔들기 진폭 2배
    const origTailAngle = pet.anim.tailAngle;
    if (pet.type === 'dog' && pet.stats && pet.stats.happiness > 70) {
      pet.anim.tailAngle *= 2;
    }

    // sick 상태를 anim에 동기화
    pet.anim.isSick = pet.isSick;

    // 새: 날개짓 빈도를 happiness에 비례시키려면 time 스케일 조정
    // (drawFeatures 내에서 anim.time * 4로 계산하므로 간접 처리)

    const renderY = pet.y + pet.bounceOffset;

    c.save();
    if (pet.facingLeft) {
      c.translate(pet.x, 0);
      c.scale(-1, 1);
      c.translate(-pet.x, 0);
    }
    drawPet(c, pet.type, pet.stage, pet.anim, pet.x, renderY, pet.size, pet.stats, pet.colorVariant);
    c.restore();

    // 꼬리 각도 복원
    pet.anim.tailAngle = origTailAngle;

    // Hunger < 15: floating bowl emoji
    if (pet.stats && pet.stats.hunger < 15) {
      const bowlY = renderY - pet.size * 0.45 + Math.sin(pet.anim.time * 3) * 3;
      c.font = '14px Apple Color Emoji, Segoe UI Emoji';
      c.textAlign = 'center';
      c.fillText('🍽️', pet.x, bowlY);
    }

    // Accessory
    if (pet.accessory) {
      c.font = '16px Apple Color Emoji, Segoe UI Emoji';
      c.textAlign = 'center';
      c.fillText(
        pet.accessory, pet.x + pet.size * 0.2,
        pet.y - pet.size * 0.3 + pet.anim.bounceY,
      );
    }

    // 이동 중 발자국
    if (pet.isMoving) {
      c.fillStyle = 'rgba(0,0,0,0.05)';
      c.beginPath();
      c.arc(pet.x, pet.y + pet.size * 0.3, 3, 0, Math.PI * 2);
      c.fill();
    }

    // 이름 태그
    this.drawNameTag(c, pet, isActive);

    // 말풍선
    if (pet.speechTimer > 0 && pet.speechAlpha > 0) {
      this.drawSpeechBubble(c, pet);
    }
  }

  private drawNameTag(
    c: CanvasRenderingContext2D, pet: CanvasPet, isActive: boolean,
  ): void {
    if (this.pets.length <= 1) return; // 1마리면 이름 태그 불필요

    const tagY = pet.y + pet.size * 0.4;
    c.font = `${isActive ? 'bold ' : ''}9px Quicksand, sans-serif`;
    c.textAlign = 'center';

    // 배경
    const metrics = c.measureText(pet.name);
    const pw = metrics.width + 8;
    c.fillStyle = isActive ? 'rgba(255,183,77,0.85)' : 'rgba(255,255,255,0.7)';
    c.beginPath();
    this.roundRect(c, pet.x - pw / 2, tagY - 6, pw, 14, 4);
    c.fill();

    // 텍스트
    c.fillStyle = isActive ? '#FFF' : '#666';
    c.textBaseline = 'middle';
    c.fillText(pet.name, pet.x, tagY + 1);
  }

  private drawSpeechBubble(c: CanvasRenderingContext2D, pet: CanvasPet): void {
    c.globalAlpha = pet.speechAlpha;
    const bubbleX = pet.x;
    const bubbleY = pet.y - pet.size * 0.5 - 20;

    c.font = '12px Quicksand, sans-serif';
    const metrics = c.measureText(pet.speechText);
    const pw = metrics.width + 16;
    const ph = 22;

    c.fillStyle = 'rgba(255,255,255,0.95)';
    c.beginPath();
    this.roundRect(c, bubbleX - pw / 2, bubbleY - ph / 2, pw, ph, 10);
    c.fill();

    c.beginPath();
    c.moveTo(bubbleX - 5, bubbleY + ph / 2);
    c.lineTo(bubbleX, bubbleY + ph / 2 + 6);
    c.lineTo(bubbleX + 5, bubbleY + ph / 2);
    c.fill();

    c.fillStyle = '#3D3D3D';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(pet.speechText, bubbleX, bubbleY);

    c.globalAlpha = 1;
  }

  private drawBackground(c: CanvasRenderingContext2D): void {
    // 테마가 적용되어 있으면 테마 배경
    if (this.roomTheme) {
      this.drawThemeBackground(c);
      return;
    }

    const timeOfDay = getTimeOfDay();
    let colors: [string, string];
    switch (timeOfDay) {
      case 'morning': colors = ['#FFF5E6', '#FFE8CC']; break;
      case 'afternoon': colors = ['#E8F4FD', '#FFF5E6']; break;
      case 'evening': colors = ['#FFD4A3', '#FFAB76']; break;
      case 'night': colors = ['#1a1a2e', '#16213e']; break;
    }
    const grad = c.createLinearGradient(0, 0, 0, this.H);
    grad.addColorStop(0, colors[0]);
    grad.addColorStop(1, colors[1]);
    c.fillStyle = grad;
    c.fillRect(0, 0, this.W, this.H);

    // Soft top-down lighting
    const lightGrad = c.createRadialGradient(
      this.W * 0.5, -10, 0,
      this.W * 0.5, -10, this.H * 0.8,
    );
    lightGrad.addColorStop(0, timeOfDay === 'night' ? 'rgba(100,130,200,0.06)' : 'rgba(255,255,240,0.18)');
    lightGrad.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = lightGrad;
    c.fillRect(0, 0, this.W, this.H);

    // 계절 데코레이션
    this.drawSeasonDecor(c, timeOfDay);

    this.drawWindow(c, timeOfDay);
    this.drawWallClock(c, timeOfDay);
    this.drawWallPicture(c);
  }

  /** 방 테마 배경 렌더링 */
  private drawThemeBackground(c: CanvasRenderingContext2D): void {
    switch (this.roomTheme) {
      case 'theme-cafe':
        this.drawCafeTheme(c);
        break;
      case 'theme-space':
        this.drawSpaceTheme(c);
        break;
      case 'theme-forest':
        this.drawForestTheme(c);
        break;
      case 'theme-pink':
        this.drawPinkTheme(c);
        break;
      default: break;
    }
  }

  private drawCafeTheme(c: CanvasRenderingContext2D): void {
    const grad = c.createLinearGradient(0, 0, 0, this.H);
    grad.addColorStop(0, '#D7B899');
    grad.addColorStop(1, '#C4A882');
    c.fillStyle = grad;
    c.fillRect(0, 0, this.W, this.H);
    // 따뜻한 조명
    const light = c.createRadialGradient(this.W * 0.5, 20, 0, this.W * 0.5, 20, this.H * 0.7);
    light.addColorStop(0, 'rgba(255,200,100,0.25)');
    light.addColorStop(1, 'rgba(255,200,100,0)');
    c.fillStyle = light;
    c.fillRect(0, 0, this.W, this.H);
    // 장식 이모지
    c.font = '16px Apple Color Emoji, Segoe UI Emoji';
    c.textAlign = 'center';
    c.fillText('☕', 30, 35);
    c.fillText('☕', this.W - 35, 30);
    c.font = '14px Apple Color Emoji, Segoe UI Emoji';
    c.fillText('🍰', 60, 25);
    c.fillText('📖', this.W - 60, 45);
  }

  private drawSpaceTheme(c: CanvasRenderingContext2D): void {
    const grad = c.createLinearGradient(0, 0, 0, this.H);
    grad.addColorStop(0, '#0D0221');
    grad.addColorStop(1, '#1A0533');
    c.fillStyle = grad;
    c.fillRect(0, 0, this.W, this.H);
    // 별들
    c.fillStyle = '#FFFFFF';
    for (let i = 0; i < 30; i++) {
      const sx = ((i * 137 + 50) % this.W);
      const sy = ((i * 89 + 20) % (this.H * 0.65));
      const sr = (i % 3 === 0) ? 1.5 : 0.8;
      c.beginPath();
      c.arc(sx, sy, sr, 0, Math.PI * 2);
      c.fill();
    }
    // 행성/장식
    c.font = '18px Apple Color Emoji, Segoe UI Emoji';
    c.textAlign = 'center';
    c.fillText('🪐', 40, 40);
    c.fillText('🌙', this.W - 45, 30);
    c.font = '12px Apple Color Emoji, Segoe UI Emoji';
    c.fillText('⭐', 80, 20);
    c.fillText('🚀', this.W - 80, 55);
  }

  private drawForestTheme(c: CanvasRenderingContext2D): void {
    const grad = c.createLinearGradient(0, 0, 0, this.H);
    grad.addColorStop(0, '#A8D5BA');
    grad.addColorStop(1, '#7CB896');
    c.fillStyle = grad;
    c.fillRect(0, 0, this.W, this.H);
    // 나무/덤불
    c.font = '20px Apple Color Emoji, Segoe UI Emoji';
    c.textAlign = 'center';
    c.fillText('🌿', 20, 40);
    c.fillText('🌿', this.W - 25, 35);
    c.font = '14px Apple Color Emoji, Segoe UI Emoji';
    c.fillText('🍄', 55, 50);
    c.fillText('🌸', this.W - 60, 25);
    c.fillText('🦋', this.W * 0.5, 20);
  }

  private drawPinkTheme(c: CanvasRenderingContext2D): void {
    const grad = c.createLinearGradient(0, 0, 0, this.H);
    grad.addColorStop(0, '#FFD1DC');
    grad.addColorStop(1, '#FFB6C1');
    c.fillStyle = grad;
    c.fillRect(0, 0, this.W, this.H);
    // 하트/리본 장식
    c.font = '16px Apple Color Emoji, Segoe UI Emoji';
    c.textAlign = 'center';
    c.fillText('🎀', 25, 30);
    c.fillText('🎀', this.W - 30, 45);
    c.font = '12px Apple Color Emoji, Segoe UI Emoji';
    c.fillText('💖', 60, 22);
    c.fillText('💖', this.W - 65, 28);
    c.fillText('🌸', this.W * 0.5 - 30, 18);
    c.fillText('🌸', this.W * 0.5 + 30, 38);
  }

  /** 계절별 배경 장식 */
  private drawSeasonDecor(c: CanvasRenderingContext2D, tod: string): void {
    switch (this.season) {
      case 'spring':
        this.drawSpringDecor(c, tod);
        break;
      case 'summer':
        this.drawSummerDecor(c, tod);
        break;
      case 'autumn':
        this.drawAutumnDecor(c, tod);
        break;
      case 'winter':
        this.drawWinterDecor(c, tod);
        break;
    }
  }

  /** 봄: 벚꽃 나무 + 분홍 파티클 */
  private drawSpringDecor(c: CanvasRenderingContext2D, _tod: string): void {
    // 벚꽃 나무 (좌측 상단)
    c.fillStyle = '#8B6F47';
    c.fillRect(8, 25, 4, 40);
    // 나뭇잎/꽃 원형
    c.fillStyle = 'rgba(255,182,193,0.45)';
    c.beginPath();
    c.arc(10, 20, 16, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(255,105,180,0.3)';
    c.beginPath();
    c.arc(18, 16, 10, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(4, 24, 9, 0, Math.PI * 2);
    c.fill();
  }

  /** 여름: 선풍기 + 수박 조각 */
  private drawSummerDecor(c: CanvasRenderingContext2D, _tod: string): void {
    // 수박 조각 (바닥 왼쪽)
    c.font = '16px Apple Color Emoji, Segoe UI Emoji';
    c.textAlign = 'center';
    c.fillText('🍉', 25, this.H * 0.72);
    // 선풍기 (벽면)
    c.font = '14px Apple Color Emoji, Segoe UI Emoji';
    c.fillText('🌀', 12, 35);
  }

  /** 가을: 단풍 나뭇잎 + 따뜻한 톤 오버레이 */
  private drawAutumnDecor(c: CanvasRenderingContext2D, _tod: string): void {
    // 따뜻한 오버레이
    c.fillStyle = 'rgba(255,140,0,0.04)';
    c.fillRect(0, 0, this.W, this.H);
    // 단풍 나뭇잎 (고정 위치)
    c.font = '12px Apple Color Emoji, Segoe UI Emoji';
    c.textAlign = 'center';
    c.fillText('🍁', 15, 28);
    c.fillText('🍂', this.W - 25, 45);
  }

  /** 겨울: 눈 쌓인 창문 + 히터 */
  private drawWinterDecor(c: CanvasRenderingContext2D, _tod: string): void {
    // 히터 불빛 (좌하단)
    c.font = '14px Apple Color Emoji, Segoe UI Emoji';
    c.textAlign = 'center';
    c.fillText('🔥', 20, this.H * 0.7);
    // 창문 위 눈 쌓임 효과 (drawWindow 전에 눈 라인)
    c.fillStyle = 'rgba(255,255,255,0.6)';
    c.beginPath();
    this.roundRect(c, this.W - 82, 8, 59, 5, 2);
    c.fill();
  }

  /** Wall clock showing current time */
  private drawWallClock(c: CanvasRenderingContext2D, tod: string): void {
    const cx = this.W * 0.5;
    const cy = 28;
    const r = 14;

    // Clock face
    c.fillStyle = tod === 'night' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.6)';
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = tod === 'night' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)';
    c.lineWidth = 1;
    c.stroke();

    // Hour/minute hands
    const now = new Date();
    const hours = now.getHours() % 12;
    const minutes = now.getMinutes();
    const hourAngle = ((hours + minutes / 60) / 12) * Math.PI * 2 - Math.PI / 2;
    const minAngle = (minutes / 60) * Math.PI * 2 - Math.PI / 2;

    c.strokeStyle = tod === 'night' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)';
    c.lineCap = 'round';

    // Hour hand
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(cx + Math.cos(hourAngle) * r * 0.5, cy + Math.sin(hourAngle) * r * 0.5);
    c.stroke();

    // Minute hand
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(cx + Math.cos(minAngle) * r * 0.7, cy + Math.sin(minAngle) * r * 0.7);
    c.stroke();

    // Center dot
    c.fillStyle = c.strokeStyle;
    c.beginPath();
    c.arc(cx, cy, 1.5, 0, Math.PI * 2);
    c.fill();
  }

  private drawWindow(c: CanvasRenderingContext2D, tod: string): void {
    if (tod !== 'night') {
      c.fillStyle = '#87CEEB40';
      c.beginPath();
      this.roundRect(c, this.W - 80, 10, 55, 55, 8);
      c.fill();
      c.strokeStyle = '#D4A57440';
      c.lineWidth = 2;
      c.stroke();
      c.fillStyle = '#FFB5C230';
      c.fillRect(this.W - 82, 10, 6, 55);
      c.fillRect(this.W - 23, 10, 6, 55);
    } else {
      c.fillStyle = '#16213e80';
      c.beginPath();
      this.roundRect(c, this.W - 80, 10, 55, 55, 8);
      c.fill();
      c.fillStyle = '#FFD700';
      for (let i = 0; i < 4; i++) {
        c.beginPath();
        c.arc(this.W - 72 + i * 12, 20 + (i % 2) * 20, 1.5, 0, Math.PI * 2);
        c.fill();
      }
    }
  }

  private drawWallPicture(c: CanvasRenderingContext2D): void {
    c.fillStyle = '#FFB5C240';
    c.beginPath();
    this.roundRect(c, 15, 18, 35, 42, 5);
    c.fill();
    c.font = '18px Apple Color Emoji';
    c.textAlign = 'center';
    c.fillText('🖼', 32, 44);
  }

  private drawFloor(c: CanvasRenderingContext2D): void {
    const floorY = this.H * 0.78;
    const floorGrad = c.createLinearGradient(0, floorY, 0, this.H);
    floorGrad.addColorStop(0, '#D7CCC8');
    floorGrad.addColorStop(1, '#BCAAA4');
    c.fillStyle = floorGrad;
    c.fillRect(0, floorY, this.W, this.H - floorY);
    c.strokeStyle = '#C0B0A0';
    c.lineWidth = 0.5;
    for (let x = 0; x < this.W; x += 50) {
      c.beginPath();
      c.moveTo(x, floorY);
      c.lineTo(x, this.H);
      c.stroke();
    }

    // Small rug in center
    const rugCX = this.W * 0.5;
    const rugCY = floorY + (this.H - floorY) * 0.4;
    const rugW = this.W * 0.35;
    const rugH = (this.H - floorY) * 0.45;
    c.fillStyle = 'rgba(255,171,145,0.22)';
    c.beginPath();
    c.ellipse(rugCX, rugCY, rugW / 2, rugH / 2, 0, 0, Math.PI * 2);
    c.fill();
    // Rug border
    c.strokeStyle = 'rgba(255,112,67,0.15)';
    c.lineWidth = 1;
    c.beginPath();
    c.ellipse(rugCX, rugCY, rugW / 2 - 3, rugH / 2 - 2, 0, 0, Math.PI * 2);
    c.stroke();
  }

  private drawFurniture(c: CanvasRenderingContext2D): void {
    if (this.furniture.length === 0) return;
    c.font = '24px Apple Color Emoji, Segoe UI Emoji';
    c.textAlign = 'center';
    const positions = [
      { x: 40, y: this.H * 0.72 },
      { x: this.W - 40, y: this.H * 0.72 },
      { x: this.W - 50, y: this.H * 0.50 },
    ];
    this.furniture.slice(0, 3).forEach((emoji, i) => {
      const pos = positions[i];
      if (pos) c.fillText(emoji, pos.x, pos.y);
    });
  }

  private emitAmbientParticle(): void {
    switch (this.season) {
      case 'spring': this.particles.emitAmbient(this.W, this.H, 'petal'); break;
      case 'summer':
        if (Math.random() < 0.3) this.particles.emitAmbient(this.W, this.H, 'sparkle');
        break;
      case 'autumn': this.particles.emitAmbient(this.W, this.H, 'leaf'); break;
      case 'winter': this.particles.emitAmbient(this.W, this.H, 'snowflake'); break;
    }
  }

  /** 펫 간 상호작용: 2마리 이상, 거리 < 60px, jealousy < 20 */
  private updatePetInteractions(_dt: number): void {
    if (this.pets.length < 2) return;

    for (let i = 0; i < this.pets.length; i++) {
      for (let j = i + 1; j < this.pets.length; j++) {
        const a = this.pets[i];
        const b = this.pets[j];

        // 쿨다운 중이면 스킵
        if (a.interactionCooldown > 0 || b.interactionCooldown > 0) continue;

        // 질투가 높으면 상호작용 안 함
        if (a.jealousy >= 20 || b.jealousy >= 20) continue;

        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 60) {
          this.triggerPetInteraction(a, b, i, j);
        }
      }
    }
  }

  private triggerPetInteraction(a: CanvasPet, b: CanvasPet, _ai: number, _bi: number): void {
    const roll = Math.random();
    if (roll < 0.5) {
      // 코 맞대기: 서로를 향해 facingLeft 설정
      a.facingLeft = a.x > b.x;
      b.facingLeft = b.x > a.x;
      this.setPetEmotion(a, 'happy');
      this.setPetEmotion(b, 'happy');
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      this.particles.emit(midX, midY - 10, 'heart', 4);
    } else {
      // 같이 걷기: 한 펫이 다른 펫을 따라감
      const follower = Math.random() < 0.5 ? a : b;
      const leader = follower === a ? b : a;
      follower.targetX = leader.x + (Math.random() - 0.5) * 30;
      follower.targetY = leader.y + (Math.random() - 0.5) * 15;
      follower.isMoving = true;
      follower.facingLeft = follower.targetX < follower.x;
      this.setPetEmotion(follower, 'happy');
      this.setPetEmotion(leader, 'happy');
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      this.particles.emit(midX, midY - 10, 'heart', 3);
    }

    // 쿨다운 설정 (15~25초)
    const cooldown = 15 + Math.random() * 10;
    a.interactionCooldown = cooldown;
    b.interactionCooldown = cooldown;
  }

  private getCurrentSeason(): 'spring' | 'summer' | 'autumn' | 'winter' {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
  }

  private roundRect(
    c: CanvasRenderingContext2D, x: number, y: number,
    w: number, h: number, r: number,
  ): void {
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
  }
}
