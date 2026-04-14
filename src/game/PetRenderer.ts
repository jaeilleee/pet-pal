/**
 * PetRenderer -- Canvas 기반 카와이 스타일 펫 캐릭터 렌더러
 *
 * 5종 펫 × 4단계 성장을 코드로 직접 그린다.
 * 둥근 몸체 + 큰 반짝이는 눈 + 볼터치 + 동물별 특징.
 * 저작권 이슈 없는 프로시저럴 아트.
 */

import type { PetType, GrowthStage } from '../data/pets';

/** 펫 색상 팔레트 */
const PET_COLORS: Record<PetType, { body: string; bodyLight: string; accent: string; eyeColor: string }> = {
  dog: { body: '#D4A574', bodyLight: '#E8C9A0', accent: '#C08850', eyeColor: '#4A3520' },
  cat: { body: '#B0B0B0', bodyLight: '#D0D0D0', accent: '#909090', eyeColor: '#2E7D32' },
  bird: { body: '#FFD54F', bodyLight: '#FFE082', accent: '#FFA726', eyeColor: '#1A1A1A' },
  pig: { body: '#FFB5C2', bodyLight: '#FFD4DC', accent: '#FF8FA3', eyeColor: '#3D3D3D' },
  reptile: { body: '#81C784', bodyLight: '#A5D6A7', accent: '#4CAF50', eyeColor: '#FF6F00' },
};

/** 성장 단계별 비율 */
const STAGE_RATIOS: Record<GrowthStage, { headRatio: number; bodyScale: number; eyeSize: number }> = {
  baby: { headRatio: 0.55, bodyScale: 0.6, eyeSize: 0.18 },
  child: { headRatio: 0.48, bodyScale: 0.75, eyeSize: 0.15 },
  teen: { headRatio: 0.42, bodyScale: 0.9, eyeSize: 0.13 },
  adult: { headRatio: 0.38, bodyScale: 1.0, eyeSize: 0.12 },
};

export interface PetAnimState {
  time: number;
  blinkTimer: number;
  isBlinking: boolean;
  tailAngle: number;
  breathScale: number;
  bounceY: number;
  emotion: 'neutral' | 'happy' | 'eating' | 'sleeping' | 'love';
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
  state.tailAngle = Math.sin(state.time * 3) * 0.3;
  state.breathScale = 1 + Math.sin(state.time * 1.5) * 0.02;
  state.bounceY = Math.sin(state.time * 2) * 2;
}

export function drawPet(
  ctx: CanvasRenderingContext2D,
  petType: PetType,
  stage: GrowthStage,
  anim: PetAnimState,
  cx: number,
  cy: number,
  size: number,
): void {
  const colors = PET_COLORS[petType];
  const ratios = STAGE_RATIOS[stage];
  const s = size * ratios.bodyScale;
  const headR = s * ratios.headRatio;
  const bodyR = s * 0.35;
  const eyeR = s * ratios.eyeSize;

  ctx.save();
  ctx.translate(cx, cy + anim.bounceY);
  ctx.scale(anim.breathScale, anim.breathScale);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.beginPath();
  ctx.ellipse(0, bodyR * 0.9, bodyR * 0.8, bodyR * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  drawBody(ctx, petType, stage, colors, bodyR, headR, anim);

  // Head
  const headY = -bodyR * 0.5 - headR * 0.5;
  drawHead(ctx, petType, stage, colors, headR, headY, eyeR, anim);

  // Accessories by pet type
  drawFeatures(ctx, petType, stage, colors, headR, bodyR, headY, anim);

  ctx.restore();
}

function drawBody(
  ctx: CanvasRenderingContext2D,
  petType: PetType,
  stage: GrowthStage,
  colors: typeof PET_COLORS[PetType],
  bodyR: number,
  headR: number,
  anim: PetAnimState,
): void {
  // Main body (round)
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, bodyR);
  grad.addColorStop(0, colors.bodyLight);
  grad.addColorStop(1, colors.body);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, bodyR * 0.85, bodyR * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Belly (lighter oval)
  ctx.fillStyle = colors.bodyLight + 'CC';
  ctx.beginPath();
  ctx.ellipse(0, bodyR * 0.1, bodyR * 0.5, bodyR * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();

  // Feet
  const footY = bodyR * 0.65;
  const footR = bodyR * 0.2;
  ctx.fillStyle = colors.accent;
  ctx.beginPath();
  ctx.ellipse(-bodyR * 0.4, footY, footR, footR * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(bodyR * 0.4, footY, footR, footR * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tail
  if (petType !== 'bird') {
    ctx.save();
    ctx.translate(bodyR * 0.7, -bodyR * 0.1);
    ctx.rotate(anim.tailAngle);
    ctx.fillStyle = colors.body;
    if (petType === 'dog') {
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
}

function drawHead(
  ctx: CanvasRenderingContext2D,
  petType: PetType,
  stage: GrowthStage,
  colors: typeof PET_COLORS[PetType],
  headR: number,
  headY: number,
  eyeR: number,
  anim: PetAnimState,
): void {
  // Head circle
  const headGrad = ctx.createRadialGradient(0, headY, 0, 0, headY, headR);
  headGrad.addColorStop(0, colors.bodyLight);
  headGrad.addColorStop(1, colors.body);
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.arc(0, headY, headR, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  const eyeSpacing = headR * 0.35;
  const eyeY = headY - headR * 0.05;
  drawEye(ctx, -eyeSpacing, eyeY, eyeR, colors.eyeColor, anim);
  drawEye(ctx, eyeSpacing, eyeY, eyeR, colors.eyeColor, anim);

  // Blush cheeks
  ctx.fillStyle = 'rgba(255,150,150,0.35)';
  ctx.beginPath();
  ctx.ellipse(-headR * 0.5, eyeY + eyeR * 1.5, eyeR * 0.8, eyeR * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(headR * 0.5, eyeY + eyeR * 1.5, eyeR * 0.8, eyeR * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mouth
  drawMouth(ctx, 0, eyeY + eyeR * 2.2, headR * 0.15, anim);

  // Nose (pet-specific)
  if (petType === 'dog' || petType === 'cat') {
    ctx.fillStyle = petType === 'dog' ? '#3D3D3D' : '#FFB5C2';
    ctx.beginPath();
    ctx.moveTo(0, eyeY + eyeR * 1.2);
    ctx.lineTo(-headR * 0.08, eyeY + eyeR * 1.5);
    ctx.lineTo(headR * 0.08, eyeY + eyeR * 1.5);
    ctx.closePath();
    ctx.fill();
  } else if (petType === 'pig') {
    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    ctx.ellipse(0, eyeY + eyeR * 1.3, headR * 0.15, headR * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    // Nostrils
    ctx.fillStyle = '#00000030';
    ctx.beginPath();
    ctx.arc(-headR * 0.06, eyeY + eyeR * 1.3, headR * 0.03, 0, Math.PI * 2);
    ctx.arc(headR * 0.06, eyeY + eyeR * 1.3, headR * 0.03, 0, Math.PI * 2);
    ctx.fill();
  } else if (petType === 'bird') {
    // Beak
    ctx.fillStyle = '#FFA726';
    ctx.beginPath();
    ctx.moveTo(0, eyeY + eyeR * 0.8);
    ctx.lineTo(-headR * 0.12, eyeY + eyeR * 1.4);
    ctx.lineTo(headR * 0.12, eyeY + eyeR * 1.4);
    ctx.closePath();
    ctx.fill();
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

function drawEye(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  anim: PetAnimState,
): void {
  if (anim.emotion === 'sleeping') {
    // Closed eyes (line)
    ctx.strokeStyle = color;
    ctx.lineWidth = r * 0.3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.5, 0.2, Math.PI - 0.2);
    ctx.stroke();
    return;
  }

  if (anim.isBlinking) {
    // Blink line
    ctx.strokeStyle = color;
    ctx.lineWidth = r * 0.25;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.6, y);
    ctx.lineTo(x + r * 0.6, y);
    ctx.stroke();
    return;
  }

  // Happy eyes (^_^ shape) — early return before normal eye
  if (anim.emotion === 'happy' || anim.emotion === 'eating') {
    ctx.fillStyle = colors_backup(color);
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

  // Normal eye — white, iris, pupil, sparkle
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 1.1, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y + r * 0.05, r * 0.65, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(x, y + r * 0.1, r * 0.35, 0, Math.PI * 2);
  ctx.fill();

  // Eye shine (kawaii sparkle)
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(x - r * 0.2, y - r * 0.2, r * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + r * 0.15, y + r * 0.15, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
}

function colors_backup(eyeColor: string): string {
  return eyeColor === '#4A3520' ? '#E8C9A0' :
    eyeColor === '#2E7D32' ? '#D0D0D0' :
    eyeColor === '#1A1A1A' ? '#FFE082' :
    eyeColor === '#FF6F00' ? '#A5D6A7' : '#FFD4DC';
}

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
    // Open mouth
    ctx.fillStyle = '#FF6B6B';
    ctx.beginPath();
    ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (anim.emotion === 'happy' || anim.emotion === 'love') {
    // Smile
    ctx.beginPath();
    ctx.arc(x, y - size * 0.3, size * 0.6, 0.2, Math.PI - 0.2);
    ctx.stroke();
  } else {
    // Small smile
    ctx.beginPath();
    ctx.arc(x, y - size * 0.2, size * 0.3, 0.3, Math.PI - 0.3);
    ctx.stroke();
  }
}

function drawFeatures(
  ctx: CanvasRenderingContext2D,
  petType: PetType,
  stage: GrowthStage,
  colors: typeof PET_COLORS[PetType],
  headR: number,
  bodyR: number,
  headY: number,
  anim: PetAnimState,
): void {
  // Ears
  if (petType === 'dog') {
    // Floppy ears
    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    ctx.ellipse(-headR * 0.75, headY - headR * 0.5, headR * 0.25, headR * 0.45, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(headR * 0.75, headY - headR * 0.5, headR * 0.25, headR * 0.45, 0.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (petType === 'cat') {
    // Pointy ears
    ctx.fillStyle = colors.body;
    drawTriangle(ctx, -headR * 0.55, headY - headR * 0.9, headR * 0.35);
    drawTriangle(ctx, headR * 0.55, headY - headR * 0.9, headR * 0.35);
    // Inner ear
    ctx.fillStyle = '#FFB5C2';
    drawTriangle(ctx, -headR * 0.55, headY - headR * 0.8, headR * 0.2);
    drawTriangle(ctx, headR * 0.55, headY - headR * 0.8, headR * 0.2);
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
  } else if (petType === 'bird') {
    // Crest/tuft
    ctx.fillStyle = colors.accent;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.ellipse(i * headR * 0.15, headY - headR * 1.0, headR * 0.08, headR * 0.25, i * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Wings
    ctx.fillStyle = colors.body;
    const wingFlap = Math.sin(anim.time * 4) * 0.15;
    ctx.save();
    ctx.translate(-bodyR * 0.7, -bodyR * 0.1);
    ctx.rotate(-0.4 + wingFlap);
    ctx.beginPath();
    ctx.ellipse(0, 0, bodyR * 0.15, bodyR * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(bodyR * 0.7, -bodyR * 0.1);
    ctx.rotate(0.4 - wingFlap);
    ctx.beginPath();
    ctx.ellipse(0, 0, bodyR * 0.15, bodyR * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (petType === 'pig') {
    // Round ears
    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    ctx.ellipse(-headR * 0.6, headY - headR * 0.7, headR * 0.22, headR * 0.25, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(headR * 0.6, headY - headR * 0.7, headR * 0.22, headR * 0.25, 0.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (petType === 'reptile') {
    // Spines/horns
    ctx.fillStyle = colors.accent;
    for (let i = 0; i < 3; i++) {
      const sx = (i - 1) * headR * 0.25;
      const sy = headY - headR * 0.9 - i * headR * 0.05;
      ctx.beginPath();
      ctx.moveTo(sx - headR * 0.08, sy + headR * 0.15);
      ctx.lineTo(sx, sy - headR * 0.1);
      ctx.lineTo(sx + headR * 0.08, sy + headR * 0.15);
      ctx.closePath();
      ctx.fill();
    }
    // Scales pattern
    ctx.fillStyle = colors.accent + '40';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(bodyR * 0.1 * (i - 1), bodyR * 0.2 * i, bodyR * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
    // Wings for teen/adult dragon
    if (stage === 'teen' || stage === 'adult') {
      ctx.fillStyle = colors.accent + '80';
      const wingSize = stage === 'adult' ? bodyR * 0.7 : bodyR * 0.45;
      const wingFlap = Math.sin(anim.time * 3) * 0.1;
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(side * bodyR * 0.6, -bodyR * 0.3);
        ctx.rotate(side * (0.5 + wingFlap));
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
}

function drawTriangle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x - size * 0.6, y + size * 0.3);
  ctx.lineTo(x + size * 0.6, y + size * 0.3);
  ctx.closePath();
  ctx.fill();
}

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
