# ARCHITECTURE — game-template

> game-template은 토마토농장 v2.78~v2.93 운영 교훈을 추출한 게임 개발 보일러플레이트다.
> 새 게임을 만들 때 이 디렉토리를 통째로 복사하고 치환 변수(__GAME_ID__ 등)만 교체한다.

---

## 폴더 트리

```
game-template/
├── index.html                    # 진입점 HTML (타이틀 교체 포인트)
├── package.json                  # 패키지명 (__GAME_ID__) — 교체 포인트
├── tsconfig.json                 # TypeScript 설정
├── vite.config.ts                # 빌드 설정
├── capacitor.config.ts           # appId (__PACKAGE__) — 교체 포인트 [생성 시 추가]
├── README.md                     # 치환 변수 목록 7종 전체 정리
│
├── src/
│   ├── main.ts                   # 앱 진입점. 게임 루프 초기화
│   ├── types/
│   │   └── vendor.d.ts           # 외부 SDK 타입 선언
│   │
│   ├── platform/                 # 플랫폼 추상화 레이어 (교체 불필요)
│   │   ├── platform.ts           # isAppsInToss / isNative / isIOS / getPlatform
│   │   ├── toss.ts               # 토스 SDK 래퍼
│   │   ├── AdManager.ts          # 광고 팩토리 (platform에 따라 분기)
│   │   ├── AdManagerNative.ts    # Android/iOS AdMob
│   │   ├── AdManagerToss.ts      # 토스 앱스인토스
│   │   ├── AdManagerWeb.ts       # 웹 (noop)
│   │   ├── SoundManager.ts       # BGM + 효과음 (Web Audio API)
│   │   ├── SoundEffects.ts       # 효과음 함수 모음
│   │   ├── ExitHandler.ts        # 앱 종료 (토스/네이티브/웹 3분기)
│   │   └── ReviewGate.ts         # 리뷰 요청 4-게이트 가드
│   │
│   ├── core/                     # 게임 코어 (교체 불필요)
│   │   └── SaveManager.ts        # 제네릭 세이브 시스템 SaveManager<TState>
│   │
│   └── ui/                       # UI 컴포넌트 (교체 불필요)
│       ├── InteractiveTutorial.ts # step 배열 주입형 튜토리얼 엔진
│       ├── tutorial-types.ts      # TutorialStep 타입 정의
│       ├── tutorial-dim.ts        # 4분할 dim 레이아웃 (Safari 호환)
│       ├── tutorial-overlay.ts    # 버블 + 스킵 버튼 오버레이
│       └── tutorial.css           # z-index 계층 + pointer-events 규칙
│
├── docs/
│   ├── PITFALLS.md               # 운영 교훈 모음 (반드시 먼저 읽기)
│   └── ARCHITECTURE.md           # 이 파일
│
└── scripts/
    ├── release.sh                 # 3종 배포 자동화 (웹+APK+ait)
    └── init-android.sh            # Capacitor Android 초기 설정
```

---

## 모듈별 역할

### platform/ — 플랫폼 추상화

| 파일 | 역할 | 교체 포인트 |
|------|------|------------|
| `platform.ts` | 실행 환경 감지 (toss/native/iOS/web) | 없음 |
| `AdManager.ts` | 팩토리: platform에 따라 3종 중 1개 반환 | 없음 |
| `AdManagerNative.ts` | AdMob 보상형/배너/전면, BGM pause 통합 | AdMob App ID (`__ADMOB_APP_ID__`), Rewarded ID (`__ADMOB_REWARDED__`) |
| `AdManagerToss.ts` | 토스 보상형 광고 | Toss Rewarded ID (`__TOSS_REWARDED__`) |
| `AdManagerWeb.ts` | 웹 noop 구현 | 없음 (수정 불필요) |
| `SoundManager.ts` | BGM 루프 + 효과음, showRewarded 연동 | BGM 파일 경로 |
| `ExitHandler.ts` | 종료 처리 분기 | 없음 |
| `ReviewGate.ts` | 스토어 리뷰 요청 4-게이트 | 쿨다운/최소시간 상수만 조정 가능 |

### core/ — 게임 데이터 계층

| 파일 | 역할 | 교체 포인트 |
|------|------|------------|
| `SaveManager.ts` | 제네릭 세이브. `SaveManager<YourState>` 형태로 게임 상태 타입 주입 | `TState` 타입 + 생성자 옵션 5종 |

**게임에서 SaveManager를 쓰는 방법:**
```ts
const save = new SaveManager<MyGameState>({
  saveKey: '__GAME_ID___save',
  legacyKey: '__GAME_ID___legacy_save',
  getInitialState: () => ({ ... }),
  serialize: (s) => JSON.stringify(s),
  deserialize: (json) => ({ ...getInitialState(), ...JSON.parse(json) }),
});
```

### ui/ — 튜토리얼 엔진

| 파일 | 역할 | 교체 포인트 |
|------|------|------------|
| `InteractiveTutorial.ts` | step 배열 주입, 가드(advancing/race-skip/dim/bubble) | step 배열 (game-specific) |
| `tutorial-dim.ts` | 4분할 dim, spotlight 구멍 뚫기 | 없음 |
| `tutorial-overlay.ts` | 말풍선 + 스킵 버튼 렌더 | 없음 |
| `tutorial.css` | z-index 계층(overlay 800/bubble 810/skip 820/modal 850) | 없음 |

---

## 교체 포인트 요약 (신규 게임 시 필수 교체)

| 치환 변수 | 위치 | 설명 |
|----------|------|------|
| `__GAME_ID__` | `package.json` name, 각종 저장 키 | 게임 식별자 (소문자, 하이픈) |
| `__PACKAGE__` | `capacitor.config.ts` appId | Android/iOS 패키지명 (reverse domain) |
| `__ADMOB_APP_ID__` | `AdManagerNative.ts` | AdMob 앱 ID |
| `__ADMOB_REWARDED__` | `AdManagerNative.ts` | AdMob 보상형 광고 유닛 ID |
| `__ADMOB_BANNER__` | `AdManagerNative.ts` | AdMob 배너 광고 유닛 ID |
| `__ADMOB_INTERSTITIAL__` | `AdManagerNative.ts` | AdMob 전면 광고 유닛 ID |
| `__TOSS_REWARDED__` | `AdManagerToss.ts` | 토스 보상형 광고 유닛 ID |
| `__TOSS_BANNER__` | `AdManagerToss.ts` | 토스 배너 광고 유닛 ID |
| `__GAME_TITLE__` | `index.html` title 태그 | 브라우저 탭에 표시되는 게임 이름 |
| `__VERCEL_ALIAS__` | `scripts/release.sh` | Vercel 고정 배포 URL |
| `__TELEGRAM_CHAT__` | `scripts/release.sh` | 텔레그램 알림 수신 chat_id |

자동 교체: `game-builder` 에이전트의 치환 변수 처리 단계 참조.

---

## 플랫폼 분기 다이어그램

```
앱 실행
    │
    ├─── isAppsInToss() = true  →  토스(ait) 환경
    │        │
    │        ├─ AdManagerToss (보상형만)
    │        ├─ ExitHandler → toss.closeWebApp()
    │        └─ ReviewGate 활성화 (Fix A 게이트 통과)
    │
    ├─── isNative() = true      →  네이티브(Capacitor) 환경
    │        │
    │        ├─ AdManagerNative (AdMob 보상형/배너/전면)
    │        ├─ ExitHandler → App.exitApp()
    │        └─ ReviewGate 비활성 (Fix A: isAppsInToss false)
    │
    └─── (그 외)                →  웹 환경
             │
             ├─ AdManagerWeb (모든 메서드 noop, hasAds() false)
             ├─ ExitHandler → window.history.back()
             └─ ReviewGate 비활성
```

---

## 빌드 파이프라인

```
npm run build          → Vite 웹 빌드 (dist/)
npx ait build          → 토스 .ait 빌드 (dist/ 덮어씀!)
npm run build          → 반드시 재빌드 (ait 이후)
vercel deploy          → 웹 배포
vercel alias set       → 고정 URL 업데이트
npx cap sync android   → Capacitor 동기화
./gradlew assembleRelease → APK 빌드
```

> 순서 주의: ait build는 dist/를 덮어쓴다. 반드시 ait → npm run build → vercel 순서.
> 자세한 교훈: `docs/PITFALLS.md#deploy` 참조.

---

## 배포 스크립트

`scripts/release.sh`가 위 파이프라인 전체를 자동화한다.

```bash
./scripts/release.sh --help          # 사용법
./scripts/release.sh --dry-run --all  # 전체 배포 시뮬레이션
./scripts/release.sh --bump --all    # 버전 올리고 전체 배포
./scripts/release.sh --web           # 웹만 배포
./scripts/release.sh --apk           # APK만 배포
```
