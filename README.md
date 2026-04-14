# game-template

ASaaS 게임 제작 템플릿. 토마토농장에서 검증된 플랫폼 레이어(platform, save, ad, sound, exit, review, tutorial)를 재사용 가능한 형태로 추출한 스캐폴드.

## 치환 변수 목록

새 게임 프로젝트 생성 시 아래 변수를 모두 치환한다.

| 변수 | 설명 | 예시 |
|------|------|------|
| `__GAME_ID__` | 게임 식별자 (package.json name, index.html title) | `tomato-farm` |
| `__PACKAGE__` | Android 패키지명 | `kr.asaas.tomatofarm` |
| `__ADMOB_APP_ID__` | AdMob 앱 ID | `ca-app-pub-XXXXXXXX~XXXXXXXX` |
| `__ADMOB_REWARDED__` | AdMob 보상형 광고 Unit ID | `ca-app-pub-XXXXXXXX/XXXXXXXX` |
| `__ADMOB_BANNER__` | AdMob 배너 광고 Unit ID | `ca-app-pub-XXXXXXXX/XXXXXXXX` |
| `__ADMOB_INTERSTITIAL__` | AdMob 전면 광고 Unit ID | `ca-app-pub-XXXXXXXX/XXXXXXXX` |
| `__TOSS_REWARDED__` | 앱인토스 보상형 광고 Key | `ait.v2.live.xxxxxxxx` |
| `__TOSS_BANNER__` | 앱인토스 배너 광고 Key | `ait.v2.live.xxxxxxxx` |
| `__VERCEL_ALIAS__` | Vercel 배포 alias 도메인 | `my-game.vercel.app` |
| `__TELEGRAM_CHAT__` | 텔레그램 알림 chat_id | `1234567890` |

## 빠른 시작

```bash
# 의존성 설치
npm install

# 개발 서버
npm run dev

# 프로덕션 빌드
npm run build
```

## 프로젝트 구조

```
src/
├── main.ts              # 엔트리포인트
├── platform/
│   ├── platform.ts      # 플랫폼 감지 (toss/native/web)
│   └── toss.ts          # 토스 SDK 연동
├── core/
│   └── SaveManager.ts   # 세이브/로드 (Phase 3)
├── ads/
│   └── AdManager.ts     # 광고 팩토리 (Phase 4)
├── sound/
│   └── SoundManager.ts  # BGM/SFX + 광고 pause (Phase 4)
├── ui/
│   ├── InteractiveTutorial.ts  # 튜토리얼 엔진 (Phase 5)
│   └── tutorial.css
└── exit/
    ├── ExitHandler.ts   # 앱 종료 (Phase 4)
    └── ReviewGate.ts    # 앱스토어 리뷰 (Phase 4)
scripts/
└── release.sh           # 3종 배포 자동화 (Phase 6)
docs/
├── PITFALLS.md          # v2.78~v2.93 교훈 (Phase 7)
└── ARCHITECTURE.md      # 폴더 트리 + 교체 포인트 (Phase 7)
samples/
└── clicker/             # 미니 샘플 게임 (Phase 8)
```

## 플랫폼 레이어

게임은 세 환경에서 실행된다:

| 플랫폼 | 감지 방법 | 광고 | 종료 | 저장 |
|--------|----------|------|------|------|
| `toss` | UserAgent TossApp / `__APPS_IN_TOSS__` | 앱인토스 SDK | 해당 없음 | 앱인토스 Storage |
| `native` | Capacitor.isNativePlatform | AdMob | App.exitApp() | localStorage |
| `web` | 나머지 | 없음(noop) | window.close() | localStorage |

## 교체 포인트

Phase별 구현 후 게임 로직을 붙이는 순서:

1. `src/main.ts` — 게임 초기화
2. `src/core/SaveManager.ts` — `TState` 타입 정의
3. `src/ads/AdManager*.ts` — AdMob Unit ID 주입
4. `scripts/release.sh` — 치환 변수 설정
