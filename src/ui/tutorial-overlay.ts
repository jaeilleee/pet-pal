/**
 * tutorial-overlay.ts — 튜토리얼 DOM overlay 생성 및 버블 렌더링
 *
 * 분리 이유: ensureOverlay + renderBubble 로직 합산이 50줄+이고
 * InteractiveTutorial.ts 300줄 제한 준수를 위해 추출.
 */

/** overlay DOM 생성 및 건너뛰기 버튼 연결. 이미 존재하면 재사용. */
export function ensureOverlay(
  current: HTMLDivElement | null,
  onSkip: () => void,
): HTMLDivElement {
  if (current) return current;

  const overlay = document.createElement('div');
  overlay.className = 'tutorial-overlay';
  overlay.id = 'tutorial-overlay';
  overlay.innerHTML = `
    <div class="tutorial-dim tutorial-dim-top"></div>
    <div class="tutorial-dim tutorial-dim-bottom"></div>
    <div class="tutorial-dim tutorial-dim-left"></div>
    <div class="tutorial-dim tutorial-dim-right"></div>
    <div class="tutorial-highlight-ring"></div>
    <div class="tutorial-bubble"></div>
    <button class="tutorial-skip">건너뛰기</button>
    <div class="tutorial-progress"></div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('.tutorial-skip')!.addEventListener('click', (e) => {
    e.preventDefault();
    onSkip();
  });

  return overlay;
}

/**
 * HTML 이스케이프 — 외부에서 주입된 step title/description이
 * 서버/CMS 기반일 때 XSS 방지. game-template은 범용 라이브러리이므로 필수.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 버블 내용 및 progress dot 렌더링 */
export function renderBubble(
  overlay: HTMLDivElement,
  title: string,
  description: string,
  currentIndex: number,
  total: number,
): void {
  const bubble = overlay.querySelector('.tutorial-bubble') as HTMLDivElement;
  const current = currentIndex + 1;

  // title/description은 escape 후 삽입, description의 줄바꿈만 <br>로 복원
  bubble.innerHTML = `
    <div class="tutorial-bubble-icon">${escapeHtml(title)}</div>
    <div class="tutorial-bubble-text">${escapeHtml(description).replace(/\n/g, '<br>')}</div>
    <div class="tutorial-bubble-step">${current} / ${total}</div>
  `;
  bubble.classList.add('tutorial-bubble-enter');
  requestAnimationFrame(() => {
    bubble.classList.remove('tutorial-bubble-enter');
  });

  const progress = overlay.querySelector('.tutorial-progress') as HTMLDivElement;
  const dots = Array.from({ length: total }, (_, i) =>
    `<span class="tutorial-dot${i < current ? ' done' : ''}${i === current - 1 ? ' active' : ''}"></span>`,
  ).join('');
  progress.innerHTML = dots;
}

/** 완료 토스트 표시 */
export function showCompletionToast(): void {
  const toast = document.createElement('div');
  toast.className = 'tutorial-complete-toast';
  toast.innerHTML = `
    <div class="tutorial-complete-icon">🎉</div>
    <div class="tutorial-complete-title">완료!</div>
    <div class="tutorial-complete-desc">튜토리얼을 마쳤습니다.</div>
  `;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('tutorial-complete-fade');
    setTimeout(() => toast.remove(), 500);
  }, 2500);
}

/** overlay 페이드 아웃 후 DOM 제거 */
export function fadeOutAndRemove(
  overlay: HTMLDivElement,
  onDone: () => void,
): void {
  overlay.classList.add('tutorial-fade-out');
  setTimeout(onDone, 400);
}
