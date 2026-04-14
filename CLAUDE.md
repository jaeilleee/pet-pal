# PetPal (pet-pal)

## 기술 스택
- Vite + TypeScript
- Capacitor (Android/iOS)
- 배포: Vercel(웹) + Google Play(APK) + 토스 앱스인토스(ait)

## 장르
다마고치 스타일 반려동물 키우기 게임

## Build & Deploy

    npm run build                         # 웹 빌드
    ./scripts/release.sh --dry-run --all  # 배포 미리보기
    ./scripts/release.sh --bump --all     # 버전 올리고 전체 배포

## 핵심 파일
- `src/platform/` — 플랫폼 추상화 (광고/사운드/종료/리뷰)
- `src/core/SaveManager.ts` — 세이브 시스템
- `src/ui/InteractiveTutorial.ts` — 튜토리얼 엔진
- `docs/PITFALLS.md` — 반드시 먼저 읽기

## 치환 변수 현황
- `__GAME_ID__` = `pet-pal` (완료)
- `__GAME_TITLE__` = `PetPal` (완료)
- `__PACKAGE__` = `kr.asaas.petpal` (완료)
- `__ADMOB_APP_ID__` = 미발급 (TODO)
- `__ADMOB_REWARDED__` = 미발급 (TODO)
- `__ADMOB_BANNER__` = 미발급 (TODO)
- `__ADMOB_INTERSTITIAL__` = 미발급 (TODO)
- `__TOSS_REWARDED__` = 미발급 (TODO)
- `__TOSS_BANNER__` = 미발급 (TODO)
- `__VERCEL_ALIAS__` = `pet-pal-game.vercel.app` (완료)
- `__TELEGRAM_CHAT__` = `8015335893` (완료)

## 참고
- 상위: @/Users/jaeil/Project/DI_electronics/CLAUDE.md
- 아키텍처: docs/ARCHITECTURE.md
- 교훈: docs/PITFALLS.md
- 베이스 템플릿: @/Users/jaeil/Project/DI_electronics/game-template/CLAUDE.md
