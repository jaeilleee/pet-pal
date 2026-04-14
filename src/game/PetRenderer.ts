/**
 * PetRenderer -- Canvas 기반 3D 클레이 스타일 펫 캐릭터 렌더러
 *
 * 5종 펫 x 4단계 성장을 코드로 직접 그린다.
 * Nintendo Kirby / 카카오프렌즈 3D / LINE Friends 3D 같은
 * 부드럽고 통통한 점토 질감을 Canvas 2D API만으로 구현.
 *
 * 3D 기법: 3단계 그라데이션, 림라이트, 스페큘러 하이라이트,
 * 앰비언트 오클루전, 질감 노이즈, 업그레이드된 눈/볼터치/그림자.
 */

import type { PetType, GrowthStage } from '../data/pets';
import type { PetStats } from '../data/state';

// ─── 색상 시스템 ──────────────────────────────────────────────

/** 3D 클레이 확장 색상 팔레트 */
interface ClayPalette {
  body: string;
  bodyLight: string;
  accent: string;
  eyeColor: string;
  shadow: string;
  highlight: string;
  rimLight: string;
}

/** 색상 변형 정의 */
export interface ColorVariant {
  id: string;
  name: string;
  body: string;
  bodyLight: string;
  accent: string;
}

export const COLOR_VARIANTS: Record<PetType, ColorVariant[]> = {
  dog: [
    { id: 'default', name: '기본', body: '#C4915C', bodyLight: '#E0B88A', accent: '#A07040' },
    { id: 'white', name: '백구', body: '#F5F5F5', bodyLight: '#FFFFFF', accent: '#E0E0E0' },
    { id: 'black', name: '흑구', body: '#424242', bodyLight: '#616161', accent: '#212121' },
  ],
  cat: [
    { id: 'default', name: '기본', body: '#9E9E9E', bodyLight: '#C8C8C8', accent: '#757575' },
    { id: 'orange', name: '치즈', body: '#FFB74D', bodyLight: '#FFCC80', accent: '#F57C00' },
    { id: 'black', name: '까만이', body: '#37474F', bodyLight: '#546E7A', accent: '#263238' },
  ],
  bird: [
    { id: 'default', name: '기본', body: '#FFC107', bodyLight: '#FFD54F', accent: '#FF9800' },
    { id: 'blue', name: '파랑새', body: '#42A5F5', bodyLight: '#90CAF9', accent: '#1E88E5' },
    { id: 'green', name: '초록새', body: '#66BB6A', bodyLight: '#A5D6A7', accent: '#43A047' },
  ],
  pig: [
    { id: 'default', name: '기본', body: '#F48FB1', bodyLight: '#F8BBD0', accent: '#EC407A' },
    { id: 'peach', name: '복숭아', body: '#FFAB91', bodyLight: '#FFCCBC', accent: '#FF7043' },
  ],
  reptile: [
    { id: 'default', name: '기본', body: '#66BB6A', bodyLight: '#81C784', accent: '#388E3C' },
    { id: 'blue', name: '파랑이', body: '#42A5F5', bodyLight: '#90CAF9', accent: '#1E88E5' },
  ],
};

/** 펫별 3D 클레이 색상 팔레트 */
const PET_COLORS: Record<PetType, ClayPalette> = {
  dog: {
    body: '#C4915C', bodyLight: '#E0B88A', accent: '#A07040', eyeColor: '#3D2B15',
    shadow: '#8B6914', highlight: '#F5DFC0', rimLight: '#FFE4C4',
  },
  cat: {
    body: '#9E9E9E', bodyLight: '#C8C8C8', accent: '#757575', eyeColor: '#1B5E20',
    shadow: '#686868', highlight: '#E8E8E8', rimLight: '#F0F0F0',
  },
  bird: {
    body: '#FFC107', bodyLight: '#FFD54F', accent: '#FF9800', eyeColor: '#1A1A1A',
    shadow: '#CC9A06', highlight: '#FFECB3', rimLight: '#FFF8E1',
  },
  pig: {
    body: '#F48FB1', bodyLight: '#F8BBD0', accent: '#EC407A', eyeColor: '#3D3D3D',
    shadow: '#C2185B', highlight: '#FCE4EC', rimLight: '#FFF0F5',
  },
  reptile: {
    body: '#66BB6A', bodyLight: '#81C784', accent: '#388E3C', eyeColor: '#E65100',
    shadow: '#2E7D32', highlight: '#C8E6C9', rimLight: '#E8F5E9',
  },
};

/** 색상 variant에 따른 3D 클레이 팔레트 반환 */
export function getColorPalette(
  petType: PetType,
  variantId?: string,
): ClayPalette {
  const base = PET_COLORS[petType];
  if (!variantId || variantId === 'default') return base;
  const variant = COLOR_VARIANTS[petType]?.find(v => v.id === variantId);
  if (!variant) return base;
  return {
    body: variant.body,
    bodyLight: variant.bodyLight,
    accent: variant.accent,
    eyeColor: base.eyeColor,
    shadow: darkenHex(variant.body, 0.65),
    highlight: lightenHex(variant.bodyLight, 0.2),
    rimLight: lightenHex(variant.bodyLight, 0.35),
  };
}

// ─── 색상 유틸리티 ──────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  const cl = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));
  return `#${cl(r).toString(16).padStart(2, '0')}${cl(g).toString(16).padStart(2, '0')}${cl(b).toString(16).padStart(2, '0')}`;
}

function darkenHex(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * factor, g * factor, b * factor);
}

function lightenHex(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

// ─── 애니메이션 상태 ────────────────────────────────────────────

/** 성장 단계별 비율 (눈 크기 강화 -- 카와이) */
const STAGE_RATIOS: Record<GrowthStage, { headRatio: number; bodyScale: number; eyeSize: number }> = {
  baby: { headRatio: 0.55, bodyScale: 0.7, eyeSize: 0.22 },
  child: { headRatio: 0.48, bodyScale: 0.8, eyeSize: 0.18 },
  teen: { headRatio: 0.42, bodyScale: 0.92, eyeSize: 0.15 },
  adult: { headRatio: 0.38, bodyScale: 1.0, eyeSize: 0.13 },
};

export interface PetAnimState {
  time: number;
  blinkTimer: number;
  isBlinking: boolean;
  tailAngle: number;
  breathScale: number;
  bounceY: number;
  emotion: 'neutral' | 'happy' | 'eating' | 'sleeping' | 'love';
  /** 펫 타입별 고유 행동 (예: 'wagging', 'grooming', 'flapping', 'sniffing', 'sunbathing') */
  customAction: string | null;
  /** customAction 남은 시간(초) */
  customActionTimer: number;
  /** 아픈 상태 시각 렌더링용 */
  isSick: boolean;
}

export function createAnimState(): PetAnimState {
  return {
    time: 0,
    blinkTimer: 3 + Math.random() * 4,
    isBlinking: false,
    tailAngle: 0,
    breathScale: 1,
    bounceY: 0,
    emotion: 'neutral',
    customAction: null,
    customActionTimer: 0,
    isSick: false,
  };
}

export function updateAnimState(state: PetAnimState, dt: number): void {
  state.time += dt;
  state.blinkTimer -= dt;
  if (state.blinkTimer <= 0) {
    if (state.isBlinking) {
      state.isBlinking = false;
      state.blinkTimer = 2 + Math.random() * 5;
    } else {
      state.isBlinking = true;
      state.blinkTimer = 0.15;
    }
  }
  state.tailAngle = Math.sin(state.time * 3) * 0.5;
  state.breathScale = 1 + Math.sin(state.time * 1.5) * 0.04;
  state.bounceY = Math.sin(state.time * 2) * 4;

  if (state.customActionTimer > 0) {
    state.customActionTimer -= dt;
    if (state.customActionTimer <= 0) {
      state.customAction = null;
      state.customActionTimer = 0;
    }
  }
}

// ─── 메인 렌더 ──────────────────────────────────────────────

export function drawPet(
  ctx: CanvasRenderingContext2D,
  petType: PetType,
  stage: GrowthStage,
  anim: PetAnimState,
  cx: number,
  cy: number,
  size: number,
  stats?: PetStats | null,
  colorVariant?: string,
): void {
  const colors = getColorPalette(petType, colorVariant);
  const ratios = STAGE_RATIOS[stage];
  const s = size * ratios.bodyScale;
  const headR = s * ratios.headRatio;
  let bodyR = s * 0.35;
  const eyeR = s * ratios.eyeSize;

  if (stats && stats.hunger < 30) {
    bodyR *= 0.92;
  }

  const showGlow = stats != null && stats.happiness > 80;

  ctx.save();
  ctx.translate(cx, cy + anim.bounceY);
  ctx.scale(anim.breathScale, anim.breathScale);

  // Sick blue tint overlay
  if (anim.isSick) {
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#4488FF';
    ctx.beginPath();
    ctx.arc(0, 0, bodyR * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Happiness glow
  if (showGlow) {
    ctx.save();
    ctx.shadowColor = '#FFD70060';
    ctx.shadowBlur = 12;
    ctx.fillStyle = 'rgba(255,215,0,0.08)';
    ctx.beginPath();
    ctx.arc(0, 0, bodyR * 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 3D Ground shadow (blur)
  drawGroundShadow(ctx, bodyR);

  // Body
  drawBody(ctx, petType, stage, colors, bodyR, headR, anim);

  // Dirt overlay
  if (stats && stats.cleanliness < 30) {
    drawDirtSpots(ctx, bodyR);
  }

  // Head
  const headY = -bodyR * 0.5 - headR * 0.5;
  drawHead(ctx, petType, stage, colors, headR, headY, eyeR, anim, stats);

  // Accessories by pet type + customAction
  drawFeatures(ctx, petType, stage, colors, headR, bodyR, headY, anim);

  // customAction 추가 렌더링
  if (anim.customAction) {
    drawCustomAction(ctx, petType, anim, headR, bodyR, headY);
  }

  ctx.restore();
}

// ─── 3D 그림자 ──────────────────────────────────────────────

function drawGroundShadow(ctx: CanvasRenderingContext2D, bodyR: number): void {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.15)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.beginPath();
  ctx.ellipse(0, bodyR * 0.85, bodyR * 0.75, bodyR * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ─── 클레이 질감 노이즈 ─────────────────────────────────────

/** 결정론적 pseudo-random (시드 기반, 매 프레임 동일 위치) */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function drawClayTexture(ctx: CanvasRenderingContext2D, rx: number, ry: number, seed: number): void {
  ctx.save();
  ctx.globalAlpha = 0.04;
  for (let i = 0; i < 18; i++) {
    const px = (seededRandom(seed + i * 7) - 0.5) * rx * 1.8;
    const py = (seededRandom(seed + i * 13 + 3) - 0.5) * ry * 1.8;
    ctx.fillStyle = seededRandom(seed + i * 19) > 0.5 ? '#FFFFFF' : '#000000';
    ctx.beginPath();
    ctx.arc(px, py, 0.8 + seededRandom(seed + i * 23) * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ─── 3D 몸체 ────────────────────────────────────────────────

function drawBody(
  ctx: CanvasRenderingContext2D,
  petType: PetType,
  stage: GrowthStage,
  colors: ClayPalette,
  bodyR: number,
  headR: number,
  anim: PetAnimState,
): void {
  const bw = bodyR * 0.85;
  const bh = bodyR * 0.8;

  // ── 3단계 그라데이션 몸체 ──
  const bodyGrad = ctx.createRadialGradient(
    -bw * 0.2, -bh * 0.3, 0,    // 상단 좌측에서 빛
    0, bh * 0.15, bodyR,
  );
  bodyGrad.addColorStop(0, colors.highlight);
  bodyGrad.addColorStop(0.45, colors.bodyLight);
  bodyGrad.addColorStop(0.75, colors.body);
  bodyGrad.addColorStop(1, colors.shadow);
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, bw, bh, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── 림라이트 (외곽 밝은 테두리) ──
  ctx.save();
  ctx.strokeStyle = colors.rimLight + '55';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, bw + 1, bh + 1, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // ── 스페큘러 하이라이트 (상단 좌측 큰 타원) ──
  ctx.save();
  ctx.globalAlpha = 0.28;
  const specGrad = ctx.createRadialGradient(
    -bw * 0.25, -bh * 0.35, 0,
    -bw * 0.25, -bh * 0.35, bw * 0.5,
  );
  specGrad.addColorStop(0, '#FFFFFF');
  specGrad.addColorStop(1, '#FFFFFF00');
  ctx.fillStyle = specGrad;
  ctx.beginPath();
  ctx.ellipse(-bw * 0.25, -bh * 0.35, bw * 0.4, bh * 0.3, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ── 바닥 접촉부 AO (그림자 밴드) ──
  ctx.save();
  ctx.globalAlpha = 0.12;
  const aoGrad = ctx.createLinearGradient(0, bh * 0.5, 0, bh);
  aoGrad.addColorStop(0, colors.shadow);
  aoGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = aoGrad;
  ctx.beginPath();
  ctx.ellipse(0, bh * 0.5, bw * 0.9, bh * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ── 배 (밝은 타원, 부드러운 그라데이션) ──
  const bellyGrad = ctx.createRadialGradient(0, bodyR * 0.1, 0, 0, bodyR * 0.1, bodyR * 0.55);
  bellyGrad.addColorStop(0, colors.highlight + 'DD');
  bellyGrad.addColorStop(0.7, colors.bodyLight + '88');
  bellyGrad.addColorStop(1, colors.bodyLight + '00');
  ctx.fillStyle = bellyGrad;
  ctx.beginPath();
  ctx.ellipse(0, bodyR * 0.1, bodyR * 0.5, bodyR * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── 클레이 질감 ──
  drawClayTexture(ctx, bw, bh, 42);

  // ── 발 (3D 셰이딩) ──
  drawClay3DFoot(ctx, -bodyR * 0.4, bodyR * 0.65, bodyR * 0.2, colors);
  drawClay3DFoot(ctx, bodyR * 0.4, bodyR * 0.65, bodyR * 0.2, colors);

  // ── 발-바닥 접합부 AO ──
  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = colors.shadow;
  ctx.beginPath();
  ctx.ellipse(-bodyR * 0.4, bodyR * 0.78, bodyR * 0.18, bodyR * 0.04, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(bodyR * 0.4, bodyR * 0.78, bodyR * 0.18, bodyR * 0.04, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ── 꼬리 ──
  if (petType !== 'bird') {
    drawTail(ctx, petType, colors, bodyR, anim);
  }
}

function drawClay3DFoot(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number,
  colors: ClayPalette,
): void {
  const footGrad = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, 0, x, y, r);
  footGrad.addColorStop(0, colors.bodyLight);
  footGrad.addColorStop(0.6, colors.accent);
  footGrad.addColorStop(1, colors.shadow);
  ctx.fillStyle = footGrad;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  // foot highlight
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.15, y - r * 0.2, r * 0.3, r * 0.2, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTail(
  ctx: CanvasRenderingContext2D,
  petType: PetType,
  colors: ClayPalette,
  bodyR: number,
  anim: PetAnimState,
): void {
  ctx.save();
  ctx.translate(bodyR * 0.7, -bodyR * 0.1);
  ctx.rotate(anim.tailAngle);

  if (petType === 'dog') {
    const tailGrad = ctx.createLinearGradient(0, 0, bodyR * 0.2, -bodyR * 0.4);
    tailGrad.addColorStop(0, colors.body);
    tailGrad.addColorStop(1, colors.bodyLight);
    ctx.fillStyle = tailGrad;
    ctx.beginPath();
    ctx.ellipse(bodyR * 0.2, -bodyR * 0.3, bodyR * 0.12, bodyR * 0.35, 0.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (petType === 'cat') {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(bodyR * 0.5, -bodyR * 0.6, bodyR * 0.3, -bodyR * 0.8);
    ctx.lineWidth = bodyR * 0.12;
    ctx.strokeStyle = colors.body;
    ctx.lineCap = 'round';
    ctx.stroke();
  } else if (petType === 'pig') {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(bodyR * 0.3, -bodyR * 0.2, bodyR * 0.4, -bodyR * 0.4, bodyR * 0.2, -bodyR * 0.5);
    ctx.lineWidth = bodyR * 0.08;
    ctx.strokeStyle = colors.accent;
    ctx.lineCap = 'round';
    ctx.stroke();
  } else if (petType === 'reptile') {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(bodyR * 0.6, 0, bodyR * 0.7, bodyR * 0.2);
    ctx.lineWidth = bodyR * 0.15;
    ctx.strokeStyle = colors.accent;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  ctx.restore();
}

// ─── 3D 머리 ────────────────────────────────────────────────

function drawHead(
  ctx: CanvasRenderingContext2D,
  petType: PetType,
  stage: GrowthStage,
  colors: ClayPalette,
  headR: number,
  headY: number,
  eyeR: number,
  anim: PetAnimState,
  stats?: PetStats | null,
): void {
  // ── 머리-몸 접합부 AO ──
  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = colors.shadow;
  ctx.beginPath();
  ctx.ellipse(0, headY + headR * 0.85, headR * 0.7, headR * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ── 3D 머리 (3단계 그라데이션) ──
  const headGrad = ctx.createRadialGradient(
    -headR * 0.2, headY - headR * 0.3, 0,
    0, headY, headR,
  );
  headGrad.addColorStop(0, colors.highlight);
  headGrad.addColorStop(0.4, colors.bodyLight);
  headGrad.addColorStop(0.75, colors.body);
  headGrad.addColorStop(1, colors.shadow);
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.arc(0, headY, headR, 0, Math.PI * 2);
  ctx.fill();

  // ── 머리 림라이트 ──
  ctx.save();
  ctx.strokeStyle = colors.rimLight + '50';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, headY, headR + 1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // ── 머리 스페큘러 하이라이트 ──
  ctx.save();
  ctx.globalAlpha = 0.3;
  const headSpec = ctx.createRadialGradient(
    -headR * 0.2, headY - headR * 0.4, 0,
    -headR * 0.2, headY - headR * 0.4, headR * 0.45,
  );
  headSpec.addColorStop(0, '#FFFFFF');
  headSpec.addColorStop(1, '#FFFFFF00');
  ctx.fillStyle = headSpec;
  ctx.beginPath();
  ctx.ellipse(-headR * 0.2, headY - headR * 0.4, headR * 0.35, headR * 0.28, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ── 이마 반사 포인트 ──
  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(-headR * 0.1, headY - headR * 0.55, headR * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ── 클레이 질감 ──
  ctx.save();
  ctx.translate(0, headY);
  drawClayTexture(ctx, headR, headR, 73);
  ctx.restore();

  // ── 눈 ──
  const eyeSpacing = headR * 0.35;
  const eyeY = headY - headR * 0.05;
  const tiredEyes = stats != null && stats.energy < 20;
  drawEye(ctx, -eyeSpacing, eyeY, eyeR, colors.eyeColor, anim, tiredEyes);
  drawEye(ctx, eyeSpacing, eyeY, eyeR, colors.eyeColor, anim, tiredEyes);

  // ── 볼터치 (RadialGradient, 더 크고 아래로) ──
  drawBlushCheek(ctx, -headR * 0.48, eyeY + eyeR * 1.7, eyeR);
  drawBlushCheek(ctx, headR * 0.48, eyeY + eyeR * 1.7, eyeR);

  // Mouth
  drawMouth(ctx, 0, eyeY + eyeR * 2.2, headR * 0.15, anim);

  // Nose (pet-specific, 3D)
  drawNose(ctx, petType, colors, headR, eyeY, eyeR);

  // Sick visuals
  if (anim.isSick) {
    drawSickOverlay(ctx, headR, headY, anim);
  }

  // Emotion particles
  if (anim.emotion === 'happy') {
    drawSparkles(ctx, 0, headY - headR, headR, anim.time);
  } else if (anim.emotion === 'love') {
    drawHearts(ctx, 0, headY - headR, headR, anim.time);
  } else if (anim.emotion === 'sleeping') {
    drawZzz(ctx, headR * 0.8, headY - headR * 0.5, anim.time);
  }
}

// ─── 3D 볼터치 ──────────────────────────────────────────────

function drawBlushCheek(ctx: CanvasRenderingContext2D, x: number, y: number, eyeR: number): void {
  const blushGrad = ctx.createRadialGradient(x, y, 0, x, y, eyeR * 1.0);
  blushGrad.addColorStop(0, 'rgba(255,130,130,0.4)');
  blushGrad.addColorStop(0.5, 'rgba(255,150,150,0.25)');
  blushGrad.addColorStop(1, 'rgba(255,170,170,0)');
  ctx.fillStyle = blushGrad;
  ctx.beginPath();
  ctx.ellipse(x, y, eyeR * 1.0, eyeR * 0.65, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ─── 3D 코 ──────────────────────────────────────────────────

function drawNose(
  ctx: CanvasRenderingContext2D,
  petType: PetType,
  colors: ClayPalette,
  headR: number,
  eyeY: number,
  eyeR: number,
): void {
  if (petType === 'dog') {
    // 반짝이는 강아지 코
    const noseGrad = ctx.createRadialGradient(
      -headR * 0.02, eyeY + eyeR * 1.25, 0,
      0, eyeY + eyeR * 1.35, headR * 0.12,
    );
    noseGrad.addColorStop(0, '#555555');
    noseGrad.addColorStop(0.5, '#3D3D3D');
    noseGrad.addColorStop(1, '#222222');
    ctx.fillStyle = noseGrad;
    ctx.beginPath();
    ctx.moveTo(0, eyeY + eyeR * 1.2);
    ctx.lineTo(-headR * 0.1, eyeY + eyeR * 1.55);
    ctx.quadraticCurveTo(0, eyeY + eyeR * 1.65, headR * 0.1, eyeY + eyeR * 1.55);
    ctx.closePath();
    ctx.fill();
    // 코 하이라이트
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(-headR * 0.02, eyeY + eyeR * 1.28, headR * 0.03, headR * 0.02, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (petType === 'cat') {
    // 반짝이는 고양이 코
    const catNoseGrad = ctx.createRadialGradient(
      -headR * 0.01, eyeY + eyeR * 1.28, 0,
      0, eyeY + eyeR * 1.35, headR * 0.1,
    );
    catNoseGrad.addColorStop(0, '#FFCDD2');
    catNoseGrad.addColorStop(0.6, '#FFB5C2');
    catNoseGrad.addColorStop(1, '#F48FB1');
    ctx.fillStyle = catNoseGrad;
    ctx.beginPath();
    ctx.moveTo(0, eyeY + eyeR * 1.2);
    ctx.lineTo(-headR * 0.08, eyeY + eyeR * 1.5);
    ctx.lineTo(headR * 0.08, eyeY + eyeR * 1.5);
    ctx.closePath();
    ctx.fill();
    // 코 하이라이트
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-headR * 0.01, eyeY + eyeR * 1.28, headR * 0.02, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (petType === 'pig') {
    // 통통한 입체 주둥이
    const pigSnoutGrad = ctx.createRadialGradient(
      -headR * 0.03, eyeY + eyeR * 1.2, 0,
      0, eyeY + eyeR * 1.3, headR * 0.18,
    );
    pigSnoutGrad.addColorStop(0, colors.bodyLight);
    pigSnoutGrad.addColorStop(0.5, colors.accent);
    pigSnoutGrad.addColorStop(1, darkenHex(colors.accent, 0.8));
    ctx.fillStyle = pigSnoutGrad;
    ctx.beginPath();
    ctx.ellipse(0, eyeY + eyeR * 1.3, headR * 0.17, headR * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    // 콧구멍
    ctx.fillStyle = '#00000035';
    ctx.beginPath();
    ctx.ellipse(-headR * 0.06, eyeY + eyeR * 1.3, headR * 0.035, headR * 0.03, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(headR * 0.06, eyeY + eyeR * 1.3, headR * 0.035, headR * 0.03, 0, 0, Math.PI * 2);
    ctx.fill();
    // 주둥이 하이라이트
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(-headR * 0.03, eyeY + eyeR * 1.18, headR * 0.05, headR * 0.03, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (petType === 'bird') {
    // 부리 (그라데이션)
    const beakGrad = ctx.createLinearGradient(0, eyeY + eyeR * 0.8, 0, eyeY + eyeR * 1.5);
    beakGrad.addColorStop(0, '#FFCC80');
    beakGrad.addColorStop(0.5, '#FFA726');
    beakGrad.addColorStop(1, '#E65100');
    ctx.fillStyle = beakGrad;
    ctx.beginPath();
    ctx.moveTo(0, eyeY + eyeR * 0.8);
    ctx.lineTo(-headR * 0.12, eyeY + eyeR * 1.4);
    ctx.lineTo(headR * 0.12, eyeY + eyeR * 1.4);
    ctx.closePath();
    ctx.fill();
    // 부리 하이라이트
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(-headR * 0.02, eyeY + eyeR * 1.0, headR * 0.03, headR * 0.06, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (petType === 'reptile') {
    // 미세한 비늘 질감 코 근처
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = colors.accent;
    const noseBaseY = eyeY + eyeR * 1.3;
    for (let i = 0; i < 5; i++) {
      const sx = (seededRandom(200 + i * 11) - 0.5) * headR * 0.3;
      const sy = noseBaseY + (seededRandom(200 + i * 17) - 0.5) * headR * 0.15;
      ctx.beginPath();
      ctx.arc(sx, sy, headR * 0.025, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // 콧구멍
    ctx.fillStyle = '#00000025';
    ctx.beginPath();
    ctx.arc(-headR * 0.04, eyeY + eyeR * 1.3, headR * 0.02, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(headR * 0.04, eyeY + eyeR * 1.3, headR * 0.02, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── 3D 눈 ──────────────────────────────────────────────────

function drawEye(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  anim: PetAnimState,
  tired = false,
): void {
  // Sick spiral eyes
  if (anim.isSick) {
    ctx.strokeStyle = '#666';
    ctx.lineWidth = r * 0.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 3; a += 0.2) {
      const sr = (a / (Math.PI * 3)) * r * 0.5;
      const sx = x + Math.cos(a + anim.time * 2) * sr;
      const sy = y + Math.sin(a + anim.time * 2) * sr;
      if (a === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    return;
  }

  if (anim.emotion === 'sleeping') {
    ctx.strokeStyle = color;
    ctx.lineWidth = r * 0.3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.5, 0.2, Math.PI - 0.2);
    ctx.stroke();
    return;
  }

  if (anim.isBlinking) {
    ctx.strokeStyle = color;
    ctx.lineWidth = r * 0.25;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.6, y);
    ctx.lineTo(x + r * 0.6, y);
    ctx.stroke();
    return;
  }

  // Happy / eating eyes (^_^)
  if (anim.emotion === 'happy' || anim.emotion === 'eating') {
    ctx.fillStyle = eyeBackupColor(color);
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = r * 0.25;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y + r * 0.2, r * 0.55, Math.PI + 0.3, -0.3, false);
    ctx.stroke();
    return;
  }

  const eyeHeightMult = tired ? 0.5 : 1.1;

  // ── 흰자 (위=밝게, 아래=약간 어둡게) ──
  const whiteGrad = ctx.createLinearGradient(x, y - r, x, y + r);
  whiteGrad.addColorStop(0, '#FFFFFF');
  whiteGrad.addColorStop(0.7, '#F5F5F5');
  whiteGrad.addColorStop(1, '#ECECEC');
  ctx.fillStyle = whiteGrad;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * eyeHeightMult, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── 아이라인 (상단 속눈썹 라인) ──
  ctx.save();
  ctx.strokeStyle = darkenHex(color, 0.6);
  ctx.lineWidth = r * 0.12;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.95, Math.PI + 0.4, -0.4, false);
  ctx.stroke();
  ctx.restore();

  // 피로 시 눈꺼풀
  if (tired) {
    ctx.fillStyle = eyeBackupColor(color);
    ctx.beginPath();
    ctx.ellipse(x, y - r * 0.25, r * 1.05, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 홍채 (RadialGradient: 가장자리 밝게, 중심 어둡게) ──
  const irisGrad = ctx.createRadialGradient(x, y + r * 0.05, 0, x, y + r * 0.05, r * 0.65);
  irisGrad.addColorStop(0, darkenHex(color, 0.7));
  irisGrad.addColorStop(0.6, color);
  irisGrad.addColorStop(1, lightenHex(color, 0.15));
  ctx.fillStyle = irisGrad;
  ctx.beginPath();
  ctx.arc(x, y + r * 0.05, r * 0.65, 0, Math.PI * 2);
  ctx.fill();

  // ── 동공 ──
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(x, y + r * 0.1, r * 0.35, 0, Math.PI * 2);
  ctx.fill();

  // ── 동공 안 미세한 파란 반사광 ──
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#6699CC';
  ctx.beginPath();
  ctx.arc(x + r * 0.08, y + r * 0.15, r * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ── 반짝임 3개 + 별 모양 하이라이트 ──
  ctx.fillStyle = '#FFFFFF';

  // 큰 반짝임 (메인)
  ctx.beginPath();
  ctx.arc(x - r * 0.22, y - r * 0.22, r * 0.3, 0, Math.PI * 2);
  ctx.fill();

  // 작은 반짝임 1
  ctx.beginPath();
  ctx.arc(x + r * 0.18, y + r * 0.18, r * 0.14, 0, Math.PI * 2);
  ctx.fill();

  // 작은 반짝임 2 (추가)
  ctx.beginPath();
  ctx.arc(x - r * 0.05, y + r * 0.3, r * 0.07, 0, Math.PI * 2);
  ctx.fill();

  // 별 모양 하이라이트
  ctx.save();
  ctx.globalAlpha = 0.6;
  drawTinyStar(ctx, x - r * 0.35, y - r * 0.35, r * 0.08);
  ctx.restore();
}

function drawTinyStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = r * 0.5;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
  }
  ctx.stroke();
}

function eyeBackupColor(eyeColor: string): string {
  return eyeColor === '#3D2B15' ? '#E0B88A' :
    eyeColor === '#1B5E20' ? '#C8C8C8' :
    eyeColor === '#1A1A1A' ? '#FFD54F' :
    eyeColor === '#E65100' ? '#81C784' : '#F8BBD0';
}

// ─── 입 ──────────────────────────────────────────────────────

function drawMouth(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  anim: PetAnimState,
): void {
  ctx.strokeStyle = '#3D3D3D';
  ctx.lineWidth = size * 0.2;
  ctx.lineCap = 'round';

  if (anim.emotion === 'eating') {
    ctx.fillStyle = '#FF6B6B';
    ctx.beginPath();
    ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (anim.emotion === 'happy' || anim.emotion === 'love') {
    ctx.beginPath();
    ctx.arc(x, y - size * 0.3, size * 0.6, 0.2, Math.PI - 0.2);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(x, y - size * 0.2, size * 0.3, 0.3, Math.PI - 0.3);
    ctx.stroke();
  }
}

// ─── Sick 오버레이 ──────────────────────────────────────────

function drawSickOverlay(
  ctx: CanvasRenderingContext2D,
  headR: number,
  headY: number,
  anim: PetAnimState,
): void {
  // 이마 땀방울
  ctx.fillStyle = '#87CEEB';
  const sweatY = headY - headR * 0.6 + Math.sin(anim.time * 4) * 2;
  ctx.beginPath();
  ctx.moveTo(headR * 0.35, sweatY);
  ctx.quadraticCurveTo(headR * 0.35 + 3, sweatY + 6, headR * 0.35, sweatY + 8);
  ctx.quadraticCurveTo(headR * 0.35 - 3, sweatY + 6, headR * 0.35, sweatY);
  ctx.fill();
  // 온도계 이모지
  ctx.font = `${headR * 0.4}px Apple Color Emoji, Segoe UI Emoji`;
  ctx.textAlign = 'center';
  ctx.fillText('🌡️', -headR * 0.7, headY - headR * 0.8);
}

// ─── 더러움 ──────────────────────────────────────────────────

function drawDirtSpots(ctx: CanvasRenderingContext2D, bodyR: number): void {
  ctx.fillStyle = 'rgba(139,90,43,0.25)';
  const spots = [
    { x: -bodyR * 0.3, y: -bodyR * 0.1 },
    { x: bodyR * 0.2, y: bodyR * 0.15 },
    { x: bodyR * 0.05, y: -bodyR * 0.3 },
  ];
  for (const spot of spots) {
    ctx.beginPath();
    ctx.arc(spot.x, spot.y, bodyR * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── customAction ────────────────────────────────────────────

function drawCustomAction(
  ctx: CanvasRenderingContext2D,
  petType: PetType,
  anim: PetAnimState,
  headR: number,
  bodyR: number,
  headY: number,
): void {
  switch (anim.customAction) {
    case 'grooming': {
      ctx.fillStyle = '#B0B0B0';
      ctx.beginPath();
      ctx.ellipse(-headR * 0.3, headY + headR * 0.6, bodyR * 0.1, bodyR * 0.15, -0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'stretch': {
      ctx.fillStyle = 'rgba(176,176,176,0.3)';
      ctx.beginPath();
      ctx.ellipse(-bodyR * 0.6, bodyR * 0.3, bodyR * 0.25, bodyR * 0.1, -0.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'sniffing': {
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const angle = -0.3 + i * 0.3;
        const sx = Math.cos(angle) * headR * 0.6;
        const sy = headY + headR * 0.8 + Math.sin(anim.time * 6) * 2;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(angle) * 6, sy + 3);
        ctx.stroke();
      }
      break;
    }
    case 'tongue': {
      const tongueLen = headR * 0.5 * Math.max(0, Math.sin(anim.time * 8));
      if (tongueLen > 1) {
        ctx.strokeStyle = '#FF6B8A';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, headY + headR * 0.5);
        ctx.lineTo(0, headY + headR * 0.5 + tongueLen);
        ctx.moveTo(0, headY + headR * 0.5 + tongueLen);
        ctx.lineTo(-2, headY + headR * 0.5 + tongueLen + 3);
        ctx.moveTo(0, headY + headR * 0.5 + tongueLen);
        ctx.lineTo(2, headY + headR * 0.5 + tongueLen + 3);
        ctx.stroke();
      }
      break;
    }
    case 'jumping': {
      ctx.fillStyle = 'rgba(200,180,150,0.3)';
      for (let i = 0; i < 3; i++) {
        const px = (i - 1) * bodyR * 0.5;
        ctx.beginPath();
        ctx.arc(px, bodyR * 0.8, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    default:
      break;
  }
}

// ─── 펫 특징 (귀/날개/수염 등) ───────────────────────────────

function drawFeatures(
  ctx: CanvasRenderingContext2D,
  petType: PetType,
  stage: GrowthStage,
  colors: ClayPalette,
  headR: number,
  bodyR: number,
  headY: number,
  anim: PetAnimState,
): void {
  if (petType === 'dog') {
    drawDogEars(ctx, colors, headR, headY);
  } else if (petType === 'cat') {
    drawCatFeatures(ctx, colors, headR, headY);
  } else if (petType === 'bird') {
    drawBirdFeatures(ctx, colors, headR, bodyR, headY, anim);
  } else if (petType === 'pig') {
    drawPigEars(ctx, colors, headR, headY);
  } else if (petType === 'reptile') {
    drawReptileFeatures(ctx, colors, headR, bodyR, headY, stage, anim);
  }
}

function drawDogEars(ctx: CanvasRenderingContext2D, colors: ClayPalette, headR: number, headY: number): void {
  for (const side of [-1, 1]) {
    const earGrad = ctx.createRadialGradient(
      side * headR * 0.65, headY - headR * 0.6, 0,
      side * headR * 0.75, headY - headR * 0.5, headR * 0.4,
    );
    earGrad.addColorStop(0, colors.bodyLight);
    earGrad.addColorStop(0.6, colors.accent);
    earGrad.addColorStop(1, colors.shadow);
    ctx.fillStyle = earGrad;
    ctx.beginPath();
    ctx.ellipse(side * headR * 0.75, headY - headR * 0.5, headR * 0.25, headR * 0.45, side * -0.3, 0, Math.PI * 2);
    ctx.fill();
    // ear AO
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = colors.shadow;
    ctx.beginPath();
    ctx.ellipse(side * headR * 0.65, headY - headR * 0.2, headR * 0.15, headR * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawCatFeatures(ctx: CanvasRenderingContext2D, colors: ClayPalette, headR: number, headY: number): void {
  // Pointy ears with 3D gradient
  for (const side of [-1, 1]) {
    ctx.fillStyle = colors.body;
    drawTriangle(ctx, side * headR * 0.55, headY - headR * 0.9, headR * 0.35);
    // Inner ear gradient
    const innerGrad = ctx.createLinearGradient(
      side * headR * 0.55, headY - headR * 0.9,
      side * headR * 0.55, headY - headR * 0.6,
    );
    innerGrad.addColorStop(0, '#FFD0DD');
    innerGrad.addColorStop(1, '#FFB5C2');
    ctx.fillStyle = innerGrad;
    drawTriangle(ctx, side * headR * 0.55, headY - headR * 0.8, headR * 0.2);
  }
  // Whiskers
  ctx.strokeStyle = '#00000030';
  ctx.lineWidth = 1;
  for (let side = -1; side <= 1; side += 2) {
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(side * headR * 0.3, headY + headR * 0.2 + i * headR * 0.1);
      ctx.lineTo(side * headR * 0.9, headY + headR * 0.15 + i * headR * 0.15);
      ctx.stroke();
    }
  }
}

function drawBirdFeatures(
  ctx: CanvasRenderingContext2D,
  colors: ClayPalette,
  headR: number,
  bodyR: number,
  headY: number,
  anim: PetAnimState,
): void {
  // Crest with gradient
  for (let i = -1; i <= 1; i++) {
    const crestGrad = ctx.createLinearGradient(
      i * headR * 0.15, headY - headR * 1.25,
      i * headR * 0.15, headY - headR * 0.75,
    );
    crestGrad.addColorStop(0, colors.highlight);
    crestGrad.addColorStop(1, colors.accent);
    ctx.fillStyle = crestGrad;
    ctx.beginPath();
    ctx.ellipse(i * headR * 0.15, headY - headR * 1.0, headR * 0.08, headR * 0.25, i * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Wings with 3D shading
  const wingFlap = Math.sin(anim.time * 4) * 0.15;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * bodyR * 0.7, -bodyR * 0.1);
    ctx.rotate(side * (-0.4 + wingFlap));
    const wingGrad = ctx.createLinearGradient(0, -bodyR * 0.4, 0, bodyR * 0.4);
    wingGrad.addColorStop(0, colors.bodyLight);
    wingGrad.addColorStop(0.5, colors.body);
    wingGrad.addColorStop(1, colors.shadow);
    ctx.fillStyle = wingGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, bodyR * 0.15, bodyR * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawPigEars(ctx: CanvasRenderingContext2D, colors: ClayPalette, headR: number, headY: number): void {
  for (const side of [-1, 1]) {
    const earGrad = ctx.createRadialGradient(
      side * headR * 0.5, headY - headR * 0.8, 0,
      side * headR * 0.6, headY - headR * 0.7, headR * 0.3,
    );
    earGrad.addColorStop(0, colors.bodyLight);
    earGrad.addColorStop(0.6, colors.accent);
    earGrad.addColorStop(1, colors.shadow);
    ctx.fillStyle = earGrad;
    ctx.beginPath();
    ctx.ellipse(side * headR * 0.6, headY - headR * 0.7, headR * 0.22, headR * 0.25, side * -0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawReptileFeatures(
  ctx: CanvasRenderingContext2D,
  colors: ClayPalette,
  headR: number,
  bodyR: number,
  headY: number,
  stage: GrowthStage,
  anim: PetAnimState,
): void {
  // Spines with gradient
  for (let i = 0; i < 3; i++) {
    const sx = (i - 1) * headR * 0.25;
    const sy = headY - headR * 0.9 - i * headR * 0.05;
    const spineGrad = ctx.createLinearGradient(sx, sy - headR * 0.1, sx, sy + headR * 0.15);
    spineGrad.addColorStop(0, colors.highlight);
    spineGrad.addColorStop(1, colors.accent);
    ctx.fillStyle = spineGrad;
    ctx.beginPath();
    ctx.moveTo(sx - headR * 0.08, sy + headR * 0.15);
    ctx.lineTo(sx, sy - headR * 0.1);
    ctx.lineTo(sx + headR * 0.08, sy + headR * 0.15);
    ctx.closePath();
    ctx.fill();
  }
  // Scales pattern (3D dots)
  for (let i = 0; i < 3; i++) {
    const scaleGrad = ctx.createRadialGradient(
      bodyR * 0.1 * (i - 1) - 1, bodyR * 0.2 * i - 1, 0,
      bodyR * 0.1 * (i - 1), bodyR * 0.2 * i, bodyR * 0.08,
    );
    scaleGrad.addColorStop(0, colors.bodyLight + '60');
    scaleGrad.addColorStop(1, colors.accent + '30');
    ctx.fillStyle = scaleGrad;
    ctx.beginPath();
    ctx.arc(bodyR * 0.1 * (i - 1), bodyR * 0.2 * i, bodyR * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }
  // Dragon wings for teen/adult
  if (stage === 'teen' || stage === 'adult') {
    const wingSize = stage === 'adult' ? bodyR * 0.7 : bodyR * 0.45;
    const wingFlap = Math.sin(anim.time * 3) * 0.1;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * bodyR * 0.6, -bodyR * 0.3);
      ctx.rotate(side * (0.5 + wingFlap));
      const dWingGrad = ctx.createLinearGradient(0, -wingSize * 0.3, side * wingSize, 0);
      dWingGrad.addColorStop(0, colors.accent + 'AA');
      dWingGrad.addColorStop(1, colors.accent + '40');
      ctx.fillStyle = dWingGrad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(side * wingSize * 0.5, -wingSize * 0.6, side * wingSize, -wingSize * 0.2);
      ctx.quadraticCurveTo(side * wingSize * 0.7, wingSize * 0.2, 0, wingSize * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}

// ─── 유틸 도형 ──────────────────────────────────────────────

function drawTriangle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x - size * 0.6, y + size * 0.3);
  ctx.lineTo(x + size * 0.6, y + size * 0.3);
  ctx.closePath();
  ctx.fill();
}

// ─── 이모션 파티클 ──────────────────────────────────────────

function drawSparkles(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, time: number): void {
  ctx.fillStyle = '#FFD700';
  for (let i = 0; i < 3; i++) {
    const angle = time * 2 + (i * Math.PI * 2) / 3;
    const sx = x + Math.cos(angle) * r * 0.8;
    const sy = y + Math.sin(angle) * r * 0.5 - r * 0.5;
    const scale = 0.5 + Math.sin(time * 4 + i) * 0.3;
    drawStar(ctx, sx, sy, r * 0.08 * scale);
  }
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
  }
  ctx.lineWidth = r * 0.4;
  ctx.strokeStyle = '#FFD700';
  ctx.stroke();
}

function drawHearts(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, time: number): void {
  for (let i = 0; i < 3; i++) {
    const hy = y - r * 0.3 - ((time * 30 + i * 40) % 80);
    const hx = x + Math.sin(time * 2 + i * 2) * r * 0.4;
    const alpha = Math.max(0, 1 - ((time * 30 + i * 40) % 80) / 80);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#FF6B8A';
    drawHeart(ctx, hx, hy, r * 0.1);
    ctx.globalAlpha = 1;
  }
}

function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y + size * 0.4);
  ctx.bezierCurveTo(x - size, y - size * 0.2, x - size * 0.5, y - size, x, y - size * 0.5);
  ctx.bezierCurveTo(x + size * 0.5, y - size, x + size, y - size * 0.2, x, y + size * 0.4);
  ctx.fill();
}

function drawZzz(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  ctx.font = 'bold 14px sans-serif';
  ctx.fillStyle = '#87CEEB';
  const offsets = [0, 12, 24];
  offsets.forEach((off, i) => {
    const zy = y - off - ((time * 15) % 30);
    const alpha = Math.max(0, 1 - zy / (y - 60));
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.fillText('z', x + i * 6, zy);
  });
  ctx.globalAlpha = 1;
}
