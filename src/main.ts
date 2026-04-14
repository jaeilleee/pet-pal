/**
 * PetPal -- 반려동물 키우기 게임 부트 시퀀스
 */

import './styles/app.css';
import '../src/ui/tutorial.css';
import { SaveManager } from './core/SaveManager';
import { createAdManager } from './platform/AdManager';
import { SoundManager } from './platform/SoundManager';
import { ExitHandler } from './platform/ExitHandler';
import { isAppsInToss } from './platform/platform';
import { showToast } from './ui/Toast';
import { SceneManager } from './scenes/SceneManager';
import { TitleScene } from './scenes/TitleScene';
import { createInitialState, migratePetStats, type PetPalState } from './data/state';
import type { AppContext } from './app/AppContext';

async function boot(): Promise<void> {
  // 1. App root
  const root = document.createElement('div');
  root.id = 'app';
  document.body.appendChild(root);

  // 2. SaveManager
  const save = new SaveManager<PetPalState>({
    saveKey: 'pet-pal:save',
    legacyKey: 'pet-pal:save',
    getInitialState: createInitialState,
    deserialize: (json: string): PetPalState => {
      const raw = JSON.parse(json) as Partial<PetPalState>;
      return {
        ...createInitialState(),
        ...raw,
        petStats: migratePetStats(raw.petStats as Partial<import('./data/state').PetStats> | undefined),
      };
    },
    onLoadFail: () => {
      showToast('저장 데이터 로드 실패. 새 게임으로 시작합니다.');
    },
  });
  save.isToss = isAppsInToss();

  // 3. CRITICAL: loadAsync BEFORE anything else
  const state = await save.loadAsync();

  // 4. Managers
  const ad = createAdManager();
  await ad.init();

  const sound = SoundManager.getInstance();
  sound.setupVisibilityHandler();

  const scenes = new SceneManager(root);

  const exit = new ExitHandler({
    onSave: () => save.saveAsync(ctx.state.current),
    onMessage: showToast,
  });

  // 5. AppContext
  const ctx: AppContext<PetPalState, SceneManager> = {
    save,
    ad,
    sound,
    exit,
    scenes,
    state: { current: state },
    toast: showToast,
  };

  // 6. Session timestamp
  ctx.state.current.sessionStartedAt = Date.now();

  // 7. First gesture → AudioContext unlock
  const unlockAudio = (): void => {
    sound.ensureContext();
    document.removeEventListener('pointerdown', unlockAudio);
    document.removeEventListener('click', unlockAudio);
  };
  document.addEventListener('pointerdown', unlockAudio, { once: true });
  document.addEventListener('click', unlockAudio, { once: true });

  // 8. Banner ad on menu (if available)
  if (ad.hasAds()) {
    ad.showBanner();
  }

  // 9. Start scene
  await scenes.switchTo(() => new TitleScene(ctx));
}

boot().catch((err: unknown) => {
  console.error('[PetPal] Boot failed:', err);
});
