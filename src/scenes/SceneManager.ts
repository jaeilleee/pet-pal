/**
 * SceneManager -- 씬 전환 (페이드 애니메이션)
 */

export interface Scene {
  mount(root: HTMLElement): void;
  unmount(): void;
}

export type SceneFactory = () => Scene;

export class SceneManager {
  private root: HTMLElement;
  private currentScene: Scene | null = null;
  private transitioning = false;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  /** 씬 전환 (150ms fade) */
  async switchTo(factory: SceneFactory): Promise<void> {
    if (this.transitioning) return;
    this.transitioning = true;

    try {
      // fade out
      this.root.style.opacity = '0';
      await wait(150);

      // unmount old
      if (this.currentScene) {
        this.currentScene.unmount();
      }
      this.root.innerHTML = '';

      // mount new
      const scene = factory();
      this.currentScene = scene;
      scene.mount(this.root);

      // fade in
      await frame();
      this.root.style.opacity = '1';
      await wait(150);
    } finally {
      this.transitioning = false;
    }
  }
}

function wait(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function frame(): Promise<void> {
  return new Promise(r => requestAnimationFrame(() => r()));
}
