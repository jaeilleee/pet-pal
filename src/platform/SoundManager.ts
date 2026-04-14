/**
 * SoundManager - Web Audio API 기반 사운드 관리자
 *
 * 원본: tomato-farm/game/src/utils/SoundManager.ts 이식 (분리 버전)
 * 효과음 구현은 SoundEffects.ts로 분리.
 *
 * ⚠️ BGM pause 규칙 (중요):
 *   - suspendForBackground()는 보상형 광고(showRewarded) 경로에서만 호출한다.
 *   - 배너 광고(showBanner/attachBanner) 경로에서는 BGM을 pause하지 않는다.
 *   - 이 규칙을 어기면 배너 렌더링 시 BGM이 중단되는 UX 버그가 발생한다.
 *     (tomato-farm v2.85에서 동일 버그 경험 — feedback memory: feedback_tomato_ad_bgm.md)
 */
import * as sfxFn from './SoundEffects';
import type { SfxContext } from './SoundEffects';

const SAVE_KEY_SOUND = '__GAME_ID___sound_prefs';

interface SoundPrefs {
  muted: boolean;
  sfxEnabled: boolean;
  bgmEnabled: boolean;
  volume: number;
}

function loadPrefs(): SoundPrefs {
  try {
    const json = localStorage.getItem(SAVE_KEY_SOUND);
    if (json) {
      const parsed = JSON.parse(json) as Partial<SoundPrefs>;
      return {
        muted: false,
        sfxEnabled: parsed.sfxEnabled ?? (parsed.muted === undefined ? true : !parsed.muted),
        bgmEnabled: parsed.bgmEnabled ?? false,
        volume: parsed.volume ?? 0.5,
      };
    }
  } catch (err) {
    console.warn('[SoundManager] loadPrefs failed', err);
  }
  return { muted: false, sfxEnabled: true, bgmEnabled: false, volume: 0.5 };
}

function savePrefs(prefs: SoundPrefs): void {
  try {
    localStorage.setItem(SAVE_KEY_SOUND, JSON.stringify(prefs));
  } catch (err) {
    console.warn('[SoundManager] savePrefs failed', err);
  }
}

export class SoundManager {
  private static instance: SoundManager;
  private ctx: AudioContext | null = null;
  private prefs: SoundPrefs;
  private bgmInterval: number | null = null;
  private bgmGain: GainNode | null = null;
  private _padOscs: OscillatorNode[] | null = null;
  private _padGain: GainNode | null = null;
  private initialized = false;

  private constructor() {
    this.prefs = loadPrefs();
  }

  static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  /** 유저 제스처(pointerdown/click) 이후 호출하여 AudioContext 잠금 해제 */
  ensureContext(): void {
    if (this.ctx && this.ctx.state !== 'closed') {
      if (this.ctx.state === 'suspended' || (this.ctx.state as string) === 'interrupted') {
        this.ctx.resume().catch(() => { /* ignore */ });
      }
      return;
    }
    try {
      // webkit prefix fallback (구형 iOS Safari/일부 WebView 호환)
      const Ctor: typeof AudioContext | undefined =
        (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) {
        this.ctx = null;
        return;
      }
      this.ctx = new Ctor();
      this.initialized = true;
      // iOS/Toss WebView: AudioContext는 'suspended' 상태로 생성되므로 명시적 resume 필요
      if ((this.ctx.state as string) !== 'running') {
        this.ctx.resume().catch(() => { /* ignore */ });
      }
      if (this.prefs.bgmEnabled) this.startBGMLoop();
    } catch {
      this.ctx = null;
    }
  }

  private get sfxCtx(): SfxContext | null {
    if (!this.initialized || !this.ctx) return null;
    return {
      ctx: this.ctx,
      volume: this.prefs.volume,
      sfxEnabled: this.prefs.sfxEnabled,
    };
  }

  // ── Effect Sound Delegates ──────────────────────────────────

  playPlant(): void { const s = this.sfxCtx; if (s) sfxFn.playPlant(s); }
  playWater(): void { const s = this.sfxCtx; if (s) sfxFn.playWater(s); }
  playHarvest(combo: number = 0): void { const s = this.sfxCtx; if (s) sfxFn.playHarvest(s, combo); }
  playCoin(): void { const s = this.sfxCtx; if (s) sfxFn.playCoin(s); }
  playLucky(): void { const s = this.sfxCtx; if (s) sfxFn.playLucky(s); }
  playLevelUp(): void { const s = this.sfxCtx; if (s) sfxFn.playLevelUp(s); }
  playMerge(): void { const s = this.sfxCtx; if (s) sfxFn.playMerge(s); }
  playClick(): void { const s = this.sfxCtx; if (s) sfxFn.playClick(s); }
  playError(): void { const s = this.sfxCtx; if (s) sfxFn.playError(s); }
  playBugAlert(): void { const s = this.sfxCtx; if (s) sfxFn.playBugAlert(s); }
  playBugCatch(): void { const s = this.sfxCtx; if (s) sfxFn.playBugCatch(s); }
  playSlotSpin(): void { const s = this.sfxCtx; if (s) sfxFn.playSlotSpin(s); }
  playFestivalStart(): void { const s = this.sfxCtx; if (s) sfxFn.playFestivalStart(s); }
  playGachaDrumroll(): void { const s = this.sfxCtx; if (s) sfxFn.playGachaDrumroll(s); }

  playSlotJackpot(): void {
    this.playLucky();
    setTimeout(() => { this.playCoin(); }, 400);
  }

  playGachaReveal(isRare: boolean): void {
    if (isRare) this.playLucky();
    else this.playCoin();
  }

  playExperimentSuccess(): void { this.playMerge(); }
  playExperimentFail(): void { this.playError(); }

  // ── BGM ────────────────────────────────────────────────────

  /** 농장 BGM — 멜로디 + 베이스 + 패드 3레이어 프로시저럴 합성 */
  private startBGMLoop(): void {
    if (this.bgmInterval !== null) return;
    if (!this.ctx) return;
    const ctx = this.ctx;

    this.bgmGain = ctx.createGain();
    this.bgmGain.gain.value = 0.20 * this.prefs.volume;
    this.bgmGain.connect(ctx.destination);

    const melodyNotes: Array<[number, number]> = [
      [523.25, 0.4], [587.33, 0.4], [659.25, 0.8], [0, 0.2],
      [783.99, 0.4], [659.25, 0.4], [587.33, 0.8], [0, 0.2],
      [523.25, 0.4], [440.00, 0.4], [523.25, 0.8], [0, 0.4],
      [659.25, 0.3], [783.99, 0.3], [880.00, 0.6], [783.99, 0.3],
      [659.25, 0.3], [523.25, 0.6], [0, 0.2],
      [440.00, 0.3], [523.25, 0.3], [587.33, 0.6], [523.25, 0.6], [0, 0.4],
      [659.25, 0.2], [659.25, 0.2], [783.99, 0.4], [880.00, 0.4], [783.99, 0.4],
      [659.25, 0.4], [587.33, 0.4], [523.25, 0.8], [0, 0.4],
      [440.00, 0.6], [523.25, 0.6], [587.33, 0.6], [523.25, 1.2], [0, 0.6],
    ];

    const bassNotes = [130.81, 146.83, 164.81, 130.81, 174.61, 146.83, 130.81, 146.83];
    let melodyIdx = 0;
    let bassIdx = 0;
    let nextMelodyTime = ctx.currentTime + 0.5;
    let nextBassTime = ctx.currentTime + 0.5;

    const padFreqs = [261.63, 329.63, 392.00];
    const padOscs: OscillatorNode[] = [];
    const padGain = ctx.createGain();
    padGain.gain.value = 0.04 * this.prefs.volume;
    padGain.connect(this.bgmGain);
    for (const freq of padFreqs) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(padGain);
      osc.start();
      padOscs.push(osc);
    }
    this._padOscs = padOscs;
    this._padGain = padGain;

    const scheduleAhead = (): void => {
      if (!this.prefs.bgmEnabled || !this.ctx) {
        this.stopBGMLoop();
        return;
      }
      const now = ctx.currentTime;
      while (nextMelodyTime < now + 0.3) {
        const [freq, dur] = melodyNotes[melodyIdx % melodyNotes.length];
        if (freq > 0) {
          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.value = freq;
          const env = ctx.createGain();
          env.gain.setValueAtTime(0.001, nextMelodyTime);
          env.gain.linearRampToValueAtTime(0.15 * this.prefs.volume, nextMelodyTime + 0.04);
          env.gain.setValueAtTime(0.12 * this.prefs.volume, nextMelodyTime + dur * 0.6);
          env.gain.exponentialRampToValueAtTime(0.001, nextMelodyTime + dur * 0.95);
          osc.connect(env);
          env.connect(this.bgmGain!);
          osc.start(nextMelodyTime);
          osc.stop(nextMelodyTime + dur);
        }
        nextMelodyTime += dur;
        melodyIdx++;
      }
      while (nextBassTime < now + 0.3) {
        const freq = bassNotes[bassIdx % bassNotes.length];
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.001, nextBassTime);
        env.gain.linearRampToValueAtTime(0.10 * this.prefs.volume, nextBassTime + 0.1);
        env.gain.setValueAtTime(0.08 * this.prefs.volume, nextBassTime + 1.8);
        env.gain.exponentialRampToValueAtTime(0.001, nextBassTime + 2.3);
        osc.connect(env);
        env.connect(this.bgmGain!);
        osc.start(nextBassTime);
        osc.stop(nextBassTime + 2.4);
        nextBassTime += 2.4;
        bassIdx++;
      }
    };

    scheduleAhead();
    this.bgmInterval = window.setInterval(scheduleAhead, 200);
  }

  private stopBGMLoop(): void {
    if (this.bgmInterval !== null) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
    if (this._padOscs) {
      this._padOscs.forEach(o => { try { o.stop(); o.disconnect(); } catch { /* ignore */ } });
      this._padOscs = null;
    }
    if (this._padGain) {
      try { this._padGain.disconnect(); } catch { /* ignore */ }
      this._padGain = null;
    }
    if (this.bgmGain) {
      try { this.bgmGain.disconnect(); } catch { /* ignore */ }
      this.bgmGain = null;
    }
  }

  toggleBGM(): boolean {
    this.prefs.bgmEnabled = !this.prefs.bgmEnabled;
    savePrefs(this.prefs);
    if (this.prefs.bgmEnabled) {
      this.ensureContext();
      this.startBGMLoop();
    } else {
      this.stopBGMLoop();
    }
    return this.prefs.bgmEnabled;
  }

  toggleSfx(): boolean {
    this.prefs.sfxEnabled = !this.prefs.sfxEnabled;
    savePrefs(this.prefs);
    return this.prefs.sfxEnabled;
  }

  /** 레거시 호환: toggleMute = toggleSfx */
  toggleMute(): boolean { return this.toggleSfx(); }

  get isMuted(): boolean { return !this.prefs.sfxEnabled; }
  get isSfxEnabled(): boolean { return this.prefs.sfxEnabled; }
  get isBgmEnabled(): boolean { return this.prefs.bgmEnabled; }

  /**
   * 백그라운드 전환 시 AudioContext 일시 중지.
   *
   * ⚠️ BGM pause 규칙: 보상형 광고(showRewarded) 경로에서만 호출.
   * 배너 광고 경로에서는 이 메서드를 호출하지 마라.
   * (참고: PITFALLS.md > Ads > BGM pause는 보상형만)
   */
  suspendForBackground(): void {
    this.stopBGMLoop();
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => { /* ignore */ });
    }
  }

  /** 포그라운드 복귀 시 AudioContext 재개 */
  resumeFromBackground(): void {
    // iOS/Toss 'interrupted' 상태도 resume 대상
    if (this.ctx && this.ctx.state !== 'running' && (this.ctx.state as string) !== 'closed') {
      this.ctx.resume().catch(() => { /* ignore */ });
    }
    if (this.prefs.bgmEnabled) this.startBGMLoop();
  }

  /**
   * Page Visibility API: 탭/앱 백그라운드 시 BGM 자동 일시정지.
   * 보상형 광고의 suspendForBackground()와 별도 — 이건 순수 visibility 전환 전용.
   */
  private visHandlerBound = false;
  setupVisibilityHandler(): void {
    // 멱등 가드 — 재호출 시 리스너 중복 금지
    if (this.visHandlerBound) return;
    this.visHandlerBound = true;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stopBGMLoop();
      } else {
        // AudioContext가 suspended일 때는 시작 금지 — 광고 재생 중 unhide 시 무음 + overlap 방지
        if (this.prefs.bgmEnabled && this.ctx && this.ctx.state !== 'suspended') {
          this.startBGMLoop();
        }
      }
    });
  }
}
