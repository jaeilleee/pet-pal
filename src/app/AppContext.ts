/**
 * AppContext — 모든 씬에 주입되는 게임 전역 의존성.
 *
 * SaveManager, AdManager, SoundManager(BGM), ExitHandler 등을
 * 단일 객체로 묶어 씬 생성자에 전달한다. 전역 변수/싱글톤 사용 최소화.
 *
 * 원본: tomato-juice/src/app/AppContext.ts (제네릭화)
 *
 * ## 사용 예시
 * ```ts
 * // 게임별로 TState, TScenes를 지정하여 구체화
 * import type { AppContext } from '../../game-template/src/app/AppContext';
 * import type { MyGameState } from './data/state';
 * import type { SceneManager } from './scenes/SceneManager';
 *
 * type MyAppContext = AppContext<MyGameState, SceneManager>;
 * ```
 *
 * `TScenes`는 프로젝트별 SceneManager 구현을 주입받기 위한 타입 파라미터다.
 * 게임에 씬 시스템이 없다면 `unknown`으로 두고 `scenes` 필드를 사용하지 말 것.
 */
import type { SaveManager } from '../core/SaveManager';
import type { IAdManager } from '../platform/AdManager';
import type { SoundManager } from '../platform/SoundManager';
import type { ExitHandler } from '../platform/ExitHandler';

export interface AppContext<TState, TScenes = unknown> {
  save: SaveManager<TState>;
  ad: IAdManager;
  sound: SoundManager;
  exit: ExitHandler;
  /** 씬 매니저 (프로젝트별 구현). 씬 시스템이 없으면 unknown으로 둘 것. */
  scenes: TScenes;
  /** 현재 게임 상태에 대한 mutable holder. 씬에서 read/write 후 save() 호출. */
  state: { current: TState };
  /** 토스트 메시지 표시 (간단한 화면 하단 알림) */
  toast: (msg: string) => void;
}
