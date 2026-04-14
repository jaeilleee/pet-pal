/**
 * tutorial-dim.ts — cutout dim 4분할 레이아웃 유틸리티
 *
 * 타겟 요소 주변에 4개의 dim 영역(top/bottom/left/right)을 배치해
 * spotlight cutout 효과를 만든다.
 *
 * 파일 분리 이유: layoutDimRegions 로직만 50줄 가까이 되므로
 * InteractiveTutorial.ts 300줄 제한을 지키기 위해 추출.
 */

export interface DimElements {
  dimTop: HTMLDivElement;
  dimBottom: HTMLDivElement;
  dimLeft: HTMLDivElement;
  dimRight: HTMLDivElement;
  ring: HTMLDivElement;
  bubble: HTMLDivElement;
}

/**
 * 타겟 없음 — 전체 화면 dim, 버블을 중앙 배치.
 * tutorialActive 상태에서 강제 완료된 스텝의 경우 타겟 DOM이 없을 수 있다.
 */
export function hideDimRegions(els: DimElements): void {
  els.dimTop.style.cssText = 'top:0;left:0;width:100%;height:100%;display:block';
  els.dimBottom.style.cssText = 'display:none';
  els.dimLeft.style.cssText = 'display:none';
  els.dimRight.style.cssText = 'display:none';
  els.ring.style.cssText = 'display:none';
}

/**
 * 버블을 화면 정중앙에 배치.
 * 타겟이 없을 때 사용 — 버블이 viewport 바깥으로 나가지 않도록 transform 기반.
 */
export function centerBubble(bubble: HTMLDivElement): void {
  bubble.style.cssText = 'top:50%;left:50%;transform:translate(-50%,-50%)';
}

/**
 * 4분할 dim 레이아웃 배치.
 *
 * WHY (cutout 버그 방지):
 * dim을 단일 full-screen div + clip-path로 구현하면 Safari/WebView에서
 * clip-path 경계 클릭이 통과되지 않아 타겟을 터치할 수 없는 버그가 발생한다.
 * 4분할 구조는 스포트라이트 구멍을 DOM 수준에서 뚫어두므로 이 문제를 원천 차단.
 */
export function layoutDimRegions(
  rect: DOMRect,
  pad: number,
  els: DimElements,
): void {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const x = Math.max(0, rect.left - pad);
  const y = Math.max(0, rect.top - pad);
  const w = rect.width + pad * 2;
  const h = rect.height + pad * 2;

  els.dimTop.style.cssText =
    `top:0;left:0;width:${vw}px;height:${y}px;display:block`;
  els.dimBottom.style.cssText =
    `top:${y + h}px;left:0;width:${vw}px;height:${vh - y - h}px;display:block`;
  els.dimLeft.style.cssText =
    `top:${y}px;left:0;width:${x}px;height:${h}px;display:block`;
  els.dimRight.style.cssText =
    `top:${y}px;left:${x + w}px;width:${vw - x - w}px;height:${h}px;display:block`;
  els.ring.style.cssText =
    `display:block;top:${y}px;left:${x}px;width:${w}px;height:${h}px`;
}

/**
 * 버블을 타겟 아래 또는 위에 배치.
 *
 * WHY (spaceBelow/spaceAbove 자동선택 필요):
 * 화면 상단 타겟(예: 상단 탭바)은 아래 공간이 충분하지만,
 * 화면 하단 타겟(예: 수확 버튼)은 버블이 viewport 아래로 잘린다.
 * 고정 방향 대신 남은 공간을 측정해 자동 선택해야 버블이 항상 보인다.
 */
export function positionBubbleNearTarget(
  rect: DOMRect,
  bubble: HTMLDivElement,
): void {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const bubbleWidth = Math.min(300, vw - 32);
  const halfWidth = bubbleWidth / 2;
  const sideMargin = 16;
  const gap = 24;

  const rawCenterX = rect.left + rect.width / 2;
  const minCenterX = sideMargin + halfWidth;
  const maxCenterX = vw - sideMargin - halfWidth;
  const centerX = Math.max(minCenterX, Math.min(rawCenterX, maxCenterX));

  const spaceBelow = vh - rect.bottom;
  const spaceAbove = rect.top;

  if (spaceBelow >= spaceAbove) {
    bubble.style.cssText =
      `top:${rect.bottom + gap}px;left:${centerX}px;` +
      `transform:translateX(-50%);max-width:${bubbleWidth}px;bottom:auto`;
  } else {
    const bottomFromVh = vh - rect.top + gap;
    bubble.style.cssText =
      `bottom:${bottomFromVh}px;left:${centerX}px;` +
      `transform:translateX(-50%);max-width:${bubbleWidth}px;top:auto`;
  }
}
