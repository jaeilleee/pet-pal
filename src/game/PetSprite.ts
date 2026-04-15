/**
 * PetSprite -- 3D 렌더링 이미지 기반 펫 스프라이트 시스템
 * Pollinations.ai로 생성한 고품질 3D 펫 이미지를 로드+표시.
 * PetRenderer(Canvas 프로시저럴)를 대체하여 사용.
 */

import type { PetType, GrowthStage } from '../data/pets';

/** 스프라이트 경로 맵 */
const SPRITE_PATHS: Record<PetType, Record<GrowthStage, string>> = {
  dog: {
    baby: '/assets/pets/dog-baby.png',
    child: '/assets/pets/dog-child.png',
    teen: '/assets/pets/dog-teen.png',
    adult: '/assets/pets/dog-adult.png',
  },
  cat: {
    baby: '/assets/pets/cat-baby.png',
    child: '/assets/pets/cat-child.png',
    teen: '/assets/pets/cat-teen.png',
    adult: '/assets/pets/cat-adult.png',
  },
  bird: {
    baby: '/assets/pets/bird-baby.png',
    child: '/assets/pets/bird-child.png',
    teen: '/assets/pets/bird-teen.png',
    adult: '/assets/pets/bird-adult.png',
  },
  pig: {
    baby: '/assets/pets/pig-baby.png',
    child: '/assets/pets/pig-child.png',
    teen: '/assets/pets/pig-teen.png',
    adult: '/assets/pets/pig-adult.png',
  },
  reptile: {
    baby: '/assets/pets/reptile-baby.png',
    child: '/assets/pets/reptile-child.png',
    teen: '/assets/pets/reptile-teen.png',
    adult: '/assets/pets/reptile-adult.png',
  },
};

/** 이미지 캐시 */
const imageCache = new Map<string, HTMLImageElement>();

/** 이미지 로드 (캐시 + 프리로드) */
export function loadPetSprite(petType: PetType, stage: GrowthStage): Promise<HTMLImageElement> {
  const path = SPRITE_PATHS[petType][stage];
  const cached = imageCache.get(path);
  if (cached && cached.complete) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = (): void => {
      imageCache.set(path, img);
      resolve(img);
    };
    img.onerror = (): void => {
      console.warn(`[PetSprite] Failed to load: ${path}`);
      reject(new Error(`Image load failed: ${path}`));
    };
    img.src = path;
  });
}

/** 모든 펫 이미지 프리로드 */
export async function preloadAllSprites(): Promise<void> {
  const promises: Promise<HTMLImageElement>[] = [];
  for (const petType of Object.keys(SPRITE_PATHS) as PetType[]) {
    for (const stage of Object.keys(SPRITE_PATHS[petType]) as GrowthStage[]) {
      promises.push(loadPetSprite(petType, stage).catch(() => new Image()));
    }
  }
  await Promise.all(promises);
}

/** Canvas에 펫 스프라이트 그리기 */
export function drawPetSprite(
  ctx: CanvasRenderingContext2D,
  petType: PetType,
  stage: GrowthStage,
  cx: number,
  cy: number,
  size: number,
  options?: {
    flipX?: boolean;
    alpha?: number;
    bounceY?: number;
    scale?: number;
  },
): void {
  const path = SPRITE_PATHS[petType][stage];
  const img = imageCache.get(path);

  if (!img || !img.complete) {
    // 이미지 아직 안 로드 → 폴백 이모지
    ctx.font = `${size * 0.8}px Apple Color Emoji`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🐾', cx, cy);
    // 비동기 로드 트리거
    loadPetSprite(petType, stage).catch(() => undefined);
    return;
  }

  const scale = options?.scale ?? 1;
  const drawW = size * 1.2 * scale;
  const drawH = size * 1.2 * scale;
  const drawX = cx - drawW / 2;
  const drawY = cy - drawH / 2 + (options?.bounceY ?? 0);

  ctx.save();

  if (options?.alpha !== undefined) {
    ctx.globalAlpha = options.alpha;
  }

  if (options?.flipX) {
    ctx.translate(cx, 0);
    ctx.scale(-1, 1);
    ctx.translate(-cx, 0);
  }

  // 바닥 그림자
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + drawH * 0.45, drawW * 0.35, drawH * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();

  // 펫 이미지
  ctx.drawImage(img, drawX, drawY, drawW, drawH);

  ctx.restore();
}

/** 스프라이트 경로 가져오기 */
export function getSpritePath(petType: PetType, stage: GrowthStage): string {
  return SPRITE_PATHS[petType][stage];
}
