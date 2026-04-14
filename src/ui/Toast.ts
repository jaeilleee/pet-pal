/**
 * Toast.ts — 글로벌 토스트 큐 시스템
 *
 * 단일 진입점 showToast()로 통일. 큐 관리 + 페이드 애니메이션.
 * 원본: tomato-juice/src/ui/Toast.ts
 *
 * 사용법:
 * ```ts
 * import { showToast } from './ui/Toast';
 * showToast('저장되었습니다', 2000);
 * ```
 *
 * CSS 필수 클래스: `.app-toast` + `.app-toast.show`
 * (프로젝트 전역 CSS에 fade-in/out 스타일을 정의할 것)
 */

interface ToastEntry {
  text: string;
  durationMs: number;
}

const queue: ToastEntry[] = [];
let active = false;
let lastShownText = '';
const MAX_QUEUE = 4;

/** 화면 하단 토스트 표시. 동시에 여러 개 호출되면 큐에 합류하여 순차 표시. */
export function showToast(text: string, durationMs: number = 2200): void {
  // 실행 중/직전 동일 텍스트 dedupe
  const last = queue[queue.length - 1];
  if (last && last.text === text) return;
  if (active && lastShownText === text && queue.length === 0) return;
  queue.push({ text, durationMs });
  while (queue.length > MAX_QUEUE) queue.shift();
  if (!active) void runQueue();
}

async function runQueue(): Promise<void> {
  active = true;
  try {
    while (queue.length > 0) {
      const entry = queue.shift();
      if (!entry) break;
      lastShownText = entry.text;
      await displayOne(entry);
      await wait(120);
    }
  } finally {
    active = false;
  }
}

function displayOne(entry: ToastEntry): Promise<void> {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'app-toast';
    el.textContent = entry.text;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => {
        try { el.remove(); } catch (err) { console.warn('[Toast] remove', err); }
        resolve();
      }, 350);
    }, entry.durationMs);
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
