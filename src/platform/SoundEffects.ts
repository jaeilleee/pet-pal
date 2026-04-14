/**
 * SoundEffects - Web Audio API 기반 프로시저럴 효과음 모음
 *
 * 원본: tomato-farm/game/src/utils/SoundManager.ts 중 효과음 섹션 분리
 * 외부 오디오 파일 없이 실시간 합성.
 * SoundManager에서 import하여 사용한다.
 */

/** 효과음 재생 컨텍스트 의존성 */
export interface SfxContext {
  readonly ctx: AudioContext;
  readonly volume: number;
  readonly sfxEnabled: boolean;
}

function gain(sfx: SfxContext, vol: number = 1): GainNode {
  const g = sfx.ctx.createGain();
  g.gain.value = vol * sfx.volume;
  g.connect(sfx.ctx.destination);
  return g;
}

/** 재생 가능 여부 */
function canPlay(sfx: SfxContext): boolean {
  return sfx.sfxEnabled && sfx.ctx.state === 'running';
}

export function playPlant(sfx: SfxContext): void {
  if (!canPlay(sfx)) return;
  const ctx = sfx.ctx;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = gain(sfx, 0.4);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, now);
  osc.frequency.exponentialRampToValueAtTime(60, now + 0.15);
  g.gain.setValueAtTime(0.4 * sfx.volume, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc.connect(g);
  osc.start(now);
  osc.stop(now + 0.2);
}

export function playWater(sfx: SfxContext): void {
  if (!canPlay(sfx)) return;
  const ctx = sfx.ctx;
  const now = ctx.currentTime;
  const bufferSize = ctx.sampleRate * 0.4;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(3000, now);
  filter.frequency.linearRampToValueAtTime(800, now + 0.35);
  filter.Q.value = 2;
  const g = gain(sfx, 0.25);
  g.gain.setValueAtTime(0.25 * sfx.volume, now);
  g.gain.linearRampToValueAtTime(0.15 * sfx.volume, now + 0.1);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
  source.connect(filter);
  filter.connect(g);
  source.start(now);
  source.stop(now + 0.4);
}

export function playHarvest(sfx: SfxContext, comboCount: number = 0): void {
  if (!canPlay(sfx)) return;
  const ctx = sfx.ctx;
  const now = ctx.currentTime;
  const pitchMult = 1 + Math.min(comboCount, 10) * 0.08;
  const osc = ctx.createOscillator();
  const g = gain(sfx, 0.35);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(600 * pitchMult, now);
  osc.frequency.exponentialRampToValueAtTime(1200 * pitchMult, now + 0.05);
  osc.frequency.exponentialRampToValueAtTime(800 * pitchMult, now + 0.15);
  g.gain.setValueAtTime(0.35 * sfx.volume, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc.connect(g);
  osc.start(now);
  osc.stop(now + 0.2);
}

export function playCoin(sfx: SfxContext): void {
  if (!canPlay(sfx)) return;
  const ctx = sfx.ctx;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = gain(sfx, 0.25);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1800, now);
  osc.frequency.exponentialRampToValueAtTime(2400, now + 0.05);
  osc.frequency.exponentialRampToValueAtTime(1800, now + 0.15);
  g.gain.setValueAtTime(0.25 * sfx.volume, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  osc.connect(g);
  osc.start(now);
  osc.stop(now + 0.25);
}

export function playLucky(sfx: SfxContext): void {
  if (!canPlay(sfx)) return;
  const ctx = sfx.ctx;
  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const g = gain(sfx, 0.3);
    osc.type = 'triangle';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.001, now + i * 0.12);
    g.gain.linearRampToValueAtTime(0.3 * sfx.volume, now + i * 0.12 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.3);
    osc.connect(g);
    osc.start(now + i * 0.12);
    osc.stop(now + i * 0.12 + 0.3);
  });
}

export function playLevelUp(sfx: SfxContext): void {
  if (!canPlay(sfx)) return;
  const ctx = sfx.ctx;
  const now = ctx.currentTime;
  const chord1 = [261.63, 329.63, 392.00];
  const chord2 = [523.25, 659.25, 783.99];
  chord1.forEach(freq => {
    const osc = ctx.createOscillator();
    const g = gain(sfx, 0.2);
    osc.type = 'square';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.2 * sfx.volume, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(g);
    osc.start(now);
    osc.stop(now + 0.25);
  });
  chord2.forEach(freq => {
    const osc = ctx.createOscillator();
    const g = gain(sfx, 0.25);
    osc.type = 'square';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.001, now + 0.2);
    g.gain.linearRampToValueAtTime(0.25 * sfx.volume, now + 0.25);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc.connect(g);
    osc.start(now + 0.2);
    osc.stop(now + 0.7);
  });
}

export function playMerge(sfx: SfxContext): void {
  if (!canPlay(sfx)) return;
  const ctx = sfx.ctx;
  const now = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  const g1 = gain(sfx, 0.2);
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(300, now);
  osc1.frequency.exponentialRampToValueAtTime(2000, now + 0.4);
  g1.gain.setValueAtTime(0.2 * sfx.volume, now);
  g1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  osc1.connect(g1);
  osc1.start(now);
  osc1.stop(now + 0.5);
  const osc2 = ctx.createOscillator();
  const g2 = gain(sfx, 0.15);
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(2000, now + 0.3);
  osc2.frequency.setValueAtTime(2500, now + 0.35);
  osc2.frequency.setValueAtTime(3000, now + 0.4);
  g2.gain.setValueAtTime(0.001, now + 0.3);
  g2.gain.linearRampToValueAtTime(0.15 * sfx.volume, now + 0.35);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
  osc2.connect(g2);
  osc2.start(now + 0.3);
  osc2.stop(now + 0.6);
}

export function playClick(sfx: SfxContext): void {
  if (!canPlay(sfx)) return;
  const ctx = sfx.ctx;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = gain(sfx, 0.15);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, now);
  osc.frequency.exponentialRampToValueAtTime(500, now + 0.06);
  g.gain.setValueAtTime(0.15 * sfx.volume, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  osc.connect(g);
  osc.start(now);
  osc.stop(now + 0.08);
}

export function playError(sfx: SfxContext): void {
  if (!canPlay(sfx)) return;
  const ctx = sfx.ctx;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = gain(sfx, 0.3);
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(200, now);
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.25);
  g.gain.setValueAtTime(0.3 * sfx.volume, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  osc.connect(g);
  osc.start(now);
  osc.stop(now + 0.35);
}

export function playBugAlert(sfx: SfxContext): void {
  if (!canPlay(sfx)) return;
  const ctx = sfx.ctx;
  const now = ctx.currentTime;
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator();
    const g = gain(sfx, 0.25);
    osc.type = 'square';
    osc.frequency.value = 440;
    g.gain.setValueAtTime(0.001, now + i * 0.15);
    g.gain.linearRampToValueAtTime(0.25 * sfx.volume, now + i * 0.15 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.1);
    osc.connect(g);
    osc.start(now + i * 0.15);
    osc.stop(now + i * 0.15 + 0.1);
  }
}

export function playBugCatch(sfx: SfxContext): void {
  if (!canPlay(sfx)) return;
  const ctx = sfx.ctx;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = gain(sfx, 0.3);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, now);
  osc.frequency.exponentialRampToValueAtTime(1000, now + 0.08);
  g.gain.setValueAtTime(0.3 * sfx.volume, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  osc.connect(g);
  osc.start(now);
  osc.stop(now + 0.12);
}

export function playSlotSpin(sfx: SfxContext): void {
  if (!canPlay(sfx)) return;
  const ctx = sfx.ctx;
  const now = ctx.currentTime;
  for (let i = 0; i < 8; i++) {
    const osc = ctx.createOscillator();
    const g = gain(sfx, 0.1);
    osc.type = 'square';
    osc.frequency.value = 300 + (i % 2) * 100;
    g.gain.setValueAtTime(0.001, now + i * 0.08);
    g.gain.linearRampToValueAtTime(0.1 * sfx.volume, now + i * 0.08 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.07);
    osc.connect(g);
    osc.start(now + i * 0.08);
    osc.stop(now + i * 0.08 + 0.07);
  }
}

export function playFestivalStart(sfx: SfxContext): void {
  if (!canPlay(sfx)) return;
  const ctx = sfx.ctx;
  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const g = gain(sfx, 0.25);
    osc.type = 'square';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.001, now + i * 0.15);
    g.gain.linearRampToValueAtTime(0.25 * sfx.volume, now + i * 0.15 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.3);
    osc.connect(g);
    osc.start(now + i * 0.15);
    osc.stop(now + i * 0.15 + 0.3);
  });
}

export function playGachaDrumroll(sfx: SfxContext): void {
  if (!canPlay(sfx)) return;
  const ctx = sfx.ctx;
  const now = ctx.currentTime;
  for (let i = 0; i < 12; i++) {
    const osc = ctx.createOscillator();
    const vol = 0.1 + i * 0.015;
    const g = gain(sfx, vol);
    osc.type = 'square';
    osc.frequency.value = 200 + i * 30;
    const t = now + i * 0.06;
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(vol * sfx.volume, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + 0.05);
  }
}
