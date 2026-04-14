/**
 * layout-tokens.ts — 공통 레이아웃 상수 & 헬퍼
 *
 * 씬 간 일관된 여백/높이/반경을 보장하기 위한 상수 모음.
 * 매직 넘버 제거 목적. 원본: tomato-farm/game/src/utils/layout.ts
 *
 * 사용 예시:
 * ```ts
 * import { CONTENT_TOP, getCardWidth } from './ui/layout-tokens';
 * const cardW = getCardWidth(window.innerWidth);
 * ```
 */

/** Layout constants for consistent spacing across all scenes */
export const SAFE_TOP = 48;
export const HUD_HEIGHT = 56;
export const NAV_HEIGHT = 72;

/** Top offset where content should start (below HUD) */
export const CONTENT_TOP = SAFE_TOP + HUD_HEIGHT;

/** Padding inside content area — space between viewport top and first element */
export const CONTENT_PADDING_TOP = 32;

/** Standard horizontal padding for cards */
export const CONTENT_PADDING_X = 16;

/** Standard card max width */
export const CARD_MAX_WIDTH = 380;

/** Standard gap between cards/sections */
export const SECTION_GAP = 12;

/** Title font size for scene headers */
export const TITLE_FONT_SIZE = '24px';

/** Subtitle font size */
export const SUBTITLE_FONT_SIZE = '13px';

/** Standard section header font size */
export const SECTION_HEADER_SIZE = '18px';

/** Standard card inner padding */
export const CARD_PADDING = 16;

/** Standard button height */
export const BUTTON_HEIGHT = 40;

/** Standard button border radius */
export const BUTTON_RADIUS = 12;

/** Standard card border radius */
export const CARD_RADIUS = 14;

/** Minimum touch target size (accessibility) */
export const MIN_TOUCH_SIZE = 44;

/** Available content height between HUD and Nav bar */
export function getContentHeight(scaleHeight: number): number {
  return scaleHeight - CONTENT_TOP - NAV_HEIGHT;
}

/** Calculate card width from screen width */
export function getCardWidth(screenWidth: number): number {
  return Math.min(screenWidth - CONTENT_PADDING_X * 2, CARD_MAX_WIDTH);
}

/** Calculate card x offset (centered) */
export function getCardX(screenWidth: number): number {
  const cardW = getCardWidth(screenWidth);
  return (screenWidth - cardW) / 2;
}

/** Truncate text to fit within a max width (approximate) */
export function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars - 1) + '...';
}
