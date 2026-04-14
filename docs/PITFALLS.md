# PITFALLS — game-template 교훈 모음

> 새 게임을 만들 때 반드시 이 파일을 먼저 읽어라.
> tomato-farm v2.78~v2.93 운영 중 발생한 실제 버그와 SaveManager 추출 시 확인한 항목을 기록한다.

---

## Save

### 원본 vs 추출본 라인별 대조 체크리스트

아래 체크리스트는 `tomato-farm/game/src/utils/GameManager.ts`의 save 관련 로직과
`game-template/src/core/SaveManager.ts`의 구현이 일치하는지 확인한다.

| # | 항목 | 원본 위치 | 추출본 위치 | 상태 |
|---|------|----------|------------|------|
| 1 | **이중 키 처리** — saveKey + legacyKey 둘 다 Storage.setItem | L3863-3866 (saveGame), L3886-3888 (saveGameAsync) | writeTossAsync(), doSaveAsync() | ✅ |
| 2 | **saveAsync await** — Storage.setItem을 반드시 await, fire-and-forget 아님 | L3885-3886 | doSaveAsync() `await Storage.setItem(...)` | ✅ |
| 3 | **resetCloudStorage 두 키 모두 removeItem** — saveKey, 'tomato_farm_phaser_save' 각각 | L4800-4802 | resetCloudStorage() saveKey + legacyKey 각각 removeItem | ✅ |
| 4 | **resetCloudStorage 후 saveGameAsync 호출** — 초기 상태 즉시 fresh save | L4805 | resetCloudStorage() 마지막에 `await this.saveAsync(this.getInitialState())` | ✅ |
| 5 | **load() JSON 파싱 실패 catch** — corrupt 세이브 시 crash 방지 | L3907-3930 내 Object.assign try/catch | load() 내 중첩 try/catch + initial state fallback | ✅ |
| 6 | **initial state fallback** — load 실패 시 getInitialState() 반환 | 암묵적 (null json → 초기화 흐름) | load() 명시적 `return this.getInitialState()` | ✅ |
| 7 | **storageFailCount 3회 알림** — 연속 실패 누적 카운트 | L3858-3861 (saveGame), L3892-3895 (saveGameAsync) | onCloudSaveFail() 훅 + storageFailCount 3 체크 | ✅ |
| 8 | **race 가드** — saveAsync 중복 호출 직렬화 | 원본에 없음 (단일 인스턴스 전제) | writeQueue Promise 체인으로 save()/saveAsync() 모두 합류 | ✅ (강화) |

**모든 항목 ✅ 확인 완료.**

### ⚠️ 마이그레이션 계약 (중요 — 조용한 버그 주의)

원본 `GameManager.loadGame()`은 JSON 파싱 후 `Object.assign` 기반으로 **60+ 필드를 명시적 기본값과 함께 마이그레이션**한다(예: `applicants || []`, `unlockedFruits ?? [...]`). `SaveManager<TState>`는 이 로직을 **의도적으로 포함하지 않으며**, `deserialize` 옵션 주입자에게 책임을 위임한다.

**새 게임에서 반드시 할 것:**
- 게임 상태에 새 필드를 추가할 때마다 `deserialize` 구현을 업데이트.
- 구 세이브 로드 테스트 케이스(이전 버전 JSON → 현재 버전 TState)를 반드시 작성.
- `deserialize: (json) => ({ ...createInitialState(), ...JSON.parse(json) })` 패턴을 최소 기본선으로.

**이를 빠뜨리면**: 구 세이브의 신규 필드가 `undefined`로 로드되어 TypeScript 타입은 통과하지만 런타임에 `cannot read property of undefined` 크래시가 발생한다. 토마토농장 v2.78 이전에 동일 패턴으로 반복 발생했던 버그.

### ⚠️ save()/saveAsync() 순서 보장

`save()`는 fire-and-forget이지만 **토스 Storage 쓰기는 writeQueue를 경유**하므로 `saveAsync()`와 시간 순서가 보장된다. 직접 `tossWrite()`를 호출하지 말 것 — 큐를 우회하면 원본 GameManager가 가졌던 잠재 race가 재현된다.

---

### 알려진 함정

**함정 1: saveAsync는 반드시 await해야 한다**
- 원본 L4805: `await this.saveGameAsync()` — resetCloudStorage 내부에서 await.
- 이를 `void`로 처리하면 앱 종료 직전 저장이 보장되지 않는다.
- game-template: `resetCloudStorage()` → `await this.saveAsync(...)` 유지.

**함정 2: 이중 키 삭제를 빠뜨리면 레거시 데이터 부활**
- 원본: `removeItem(SAVE_KEY)` + `removeItem('tomato_farm_phaser_save')` 두 번.
- 하나만 지우면 다음 실행 시 레거시 키에서 복구되어 초기화가 무효화된다.
- game-template: `saveKey !== legacyKey` 조건 분기로 항상 두 키 삭제.

**함정 3: localStorage 저장 실패는 조용히 삼키면 안 된다**
- 원본: catch에서 emit('notification', '저장 실패! 용량 확인') 호출.
- game-template: `onSaveFail()` / `onCloudSaveFail()` protected 훅으로 override 가능.
- 게임 클래스에서 SaveManager를 상속하거나 이벤트 emit 로직으로 연결.

---

## Tutorial

### ⚠️ race-skip 루프 없이 advanceStep 구현하면 "좀비 스텝" 발생

- **배경**: 토마토농장에서 water 스텝 진행 중 유저가 빠르게 harvest까지 완료하면
  advanceStep 진입 시 harvest 스텝이 이미 완료 상태인데 render()가 실행되어
  highlight가 멈추는 "좀비 스텝" 버그가 발생했다.
- **원인**: captureBaseline 없이 isAdvanceReady만 검사했기 때문. baseline 기준점이 없으면
  "이미 완료된 상태"와 "방금 완료한 상태"를 구분할 수 없다.
- **교훈**: `advanceStep` 진입부에서 반드시 race-skip 루프를 실행하라.
  `isStepActionDone(ctx)`으로 baseline 없이 즉석 판정 가능한 함수를 먼저 호출해
  이미 완료된 스텝을 연속 스킵한다. 이후 살아남은 스텝에만 `captureBaseline` 적용.

### ⚠️ advancing 플래그 없이 scheduleAdvance 구현하면 advanceStep 중복 실행

- **배경**: 폴링(200ms 간격)이 `isAdvanceReady`를 여러 번 true로 감지하면
  `scheduleAdvance`가 연속 호출되어 `advanceStep`이 중복 실행된다.
  스텝이 2~3개씩 한꺼번에 건너뛰는 버그로 이어진다.
- **교훈**: `advancing` boolean 플래그로 첫 번째 예약 이후를 모두 차단한다.
  `scheduleAdvance` 진입부에서 `if (this.advancing || !this.active) return;`
  `advanceStep` 시작부에서 `this.advancing = false;`로 리셋.

### ⚠️ cutout dim을 단일 clip-path로 구현하면 Safari/WebView에서 터치 통과 안 됨

- **배경**: 단일 full-screen dim div에 clip-path를 적용하면 Safari와 WebView에서
  clip-path 경계 터치가 통과되지 않아 타겟 요소를 터치할 수 없는 버그 발생.
- **원인**: Safari의 clip-path + pointer-events 처리가 Chrome과 다름.
- **교훈**: dim을 4분할(top/bottom/left/right) DOM 구조로 구현한다.
  스포트라이트 구멍을 DOM 수준에서 뚫어두면 Safari/WebView에서도
  타겟 터치가 100% 통과된다. `layoutDimRegions()` 함수 참조.

---

## Ads

### ⚠️ BGM pause는 보상형 광고(showRewarded)에서만

- **배경**: tomato-farm v2.85에서 배너 광고 표시 시 BGM이 끊기는 UX 버그 발생.
- **원인**: `showBanner()` 경로에서 `suspendForBackground()`를 호출하고 있었음.
- **교훈**: `suspendForBackground()` / `resumeFromBackground()` 는 **보상형 광고(showRewarded) 경로에서만** 호출한다. 배너(`showBanner`) 경로에는 절대 추가하지 마라.
- **적용**: AdManagerNative.showBanner, AdManagerToss.showBanner에서 BGM suspend 호출 없음. showRewarded에서만 suspendBGM/resumeBGM 파라미터를 받아 호출.

### ⚠️ 네이티브 SDK는 dynamic import만 — static import 금지

- **배경**: `@capacitor-community/admob`, `@apps-in-toss/web-framework`, `@capacitor/app` 를 static import하면 웹 빌드 번들에 포함되어 크기가 수십 KB 증가하고 브라우저에서 오류 발생.
- **교훈**: 네이티브 전용 SDK는 반드시 `await import(...)` 형태로만 사용. `import type`은 타입 정보만이므로 예외.
- **검증**: `npm run build` 후 dist JS 파일에 SDK 패키지명이 없어야 함.

### ⚠️ AdManagerToss의 보상형 광고 이중 요청 방지

- **배경**: `loadFullScreenAd` 콜백에서 `preloadRewarded()`를 재호출하기 전 기존 listener를 해제하지 않으면 이벤트가 중복 등록됨.
- **교훈**: `preloadRewarded()` 진입 시 `this.unregisterLoad?.()` 를 먼저 호출해 이전 listener를 정리한다. dismissed/failedToLoad 콜백 안에서도 재호출 전 정리가 선행되어야 함.

---

## Deploy

### ⚠️ ait build가 dist/를 덮어쓴다 — 순서: ait → web build → vercel

- **배경**: tomato-farm에서 `npx ait build` 후 Vercel에 배포했더니 토스 .ait 포맷의 dist가
  그대로 웹에 올라가 흰 화면 발생.
- **원인**: `npx ait build`가 `dist/` 폴더를 .ait 최적화 번들로 덮어쓴다.
- **교훈**: 반드시 **.ait 빌드 → npm run build(재빌드) → vercel** 순서를 지킨다.
  `release.sh --all`은 이 순서를 강제한다: `step_ait_build → step_web_build → step_vercel_deploy`.
- **적용**: `--web`만 배포할 때도 직전에 `npx ait build`를 돌렸다면 반드시 `npm run build`로 재빌드.

### ⚠️ vercel alias를 빠뜨리면 고정 URL이 stale해진다

- **배경**: Vercel은 새 배포마다 새 URL을 발급하지만, 커스텀 alias(`__VERCEL_ALIAS__`)는
  자동 업데이트하지 않는다. alias 단계를 빠뜨리면 이전 배포를 계속 가리킨다.
- **교훈**: `vercel deploy --prod --yes` 출력 URL을 캡처해 `vercel alias set <url> __VERCEL_ALIAS__`
  를 반드시 실행한다. `release.sh`는 `step_vercel_deploy → step_vercel_alias` 연속 실행.
- **금지 패턴**: `vercel deploy dist --prod --yes` — `dist`가 프로젝트 이름으로 해석됨.

### ⚠️ 3종 배포를 반드시 같이 — 하나만 하면 버전 불일치

- **배경**: 웹만 배포하고 .ait/APK를 빠뜨린 적 있음. 토스 앱 내 버전이 구버전 상태로 유지.
- **교훈**: `release.sh --all`로 웹+APK+ait 동시 배포. 개별 타겟 배포 시 버전 불일치 위험
  을 인지하고 나머지 타겟도 빠른 시일 내 업데이트.
- **순서**: bump version → ait build → npm run build → vercel deploy → vercel alias → cap sync → gradlew → rename → rclone → telegram

---

## Review Gate

### ⚠️ 4개 게이트를 모두 통과해야 스토어 정책 위반 방지

- **배경**: 토스 앱스토어/구글플레이는 리뷰 요청 남용에 민감. 사용자가 앱을 제대로 경험하기 전에 팝업이 뜨면 즉시 1점 리뷰로 이어진다.
- **4개 게이트**:
  1. **Fix A 플래그** — `isAppsInToss()` true여야 함 (토스 환경 아닌 경우 완전 비활성)
  2. **세션 1회** — `calledThisSession` 모듈 레벨 플래그로 탭 새로고침 시 리셋
  3. **쿨다운(3일)** — `lastReviewRequestAt` 기반. 세이브 데이터에 저장해야 함
  4. **최소 플레이(30분)** — `sessionStartedAt` 기반. 세션 시작 시각을 GameManager에서 기록
- **교훈**: 4개 중 하나라도 누락하면 유저가 게임 시작 직후 리뷰 팝업을 받는 상황 발생. `canRequestReview(state)` 결과를 반드시 확인 후 `requestReview` 호출.

### ⚠️ state.lastReviewRequestAt은 반드시 세이브 데이터에 포함

- **배경**: 모듈 레벨 변수(`calledThisSession`)는 탭 새로고침 시 리셋. 쿨다운은 localStorage나 세이브 데이터에 persist해야 앱 재실행 후에도 보장.
- **교훈**: `tryRequestReview()`가 `true`를 반환하면 호출부에서 `state.lastReviewRequestAt = Date.now()`로 업데이트 후 반드시 `saveAsync()` 호출. 이를 빠뜨리면 쿨다운이 앱 재실행 후 초기화된다.

---

## Versioning

### ⚠️ APK 빌드 시 versionCode/versionName 반드시 올릴 것

- **배경**: tomato-farm에서 코드만 수정하고 versionCode를 안 올렸더니, 구글플레이가
  "이미 최신 버전"으로 인식해 업데이트 푸시가 되지 않았다. 스토어 업로드도 versionCode 중복
  으로 거부됨.
- **교훈**: APK 빌드 전 반드시 `--bump` 플래그로 버전 증가. `release.sh`는
  `step_bump`를 최우선으로 실행하며, `build.gradle`의 `versionCode`+1, `versionName` 동시 갱신.
- **수동 배포 시**: `android/app/build.gradle`에서 `versionCode`와 `versionName` 두 줄을 함께 올린다.

### ⚠️ patch/minor/major 구분

- **patch** (기본): 버그 수정, 밸런스 조정 — `1.0.0 → 1.0.1`
- **minor**: 신규 콘텐츠(맵/아이템/시스템 추가) — `1.0.0 → 1.1.0`
- **major**: 대규모 리팩토링, 세이브 포맷 변경 (구 세이브 마이그레이션 필요) — `1.0.0 → 2.0.0`
- `release.sh --bump minor --all` 처럼 명시 지정 권장.

---

## v2.94+ 백포트 교훈 (tomato-juice/tomato-farm에서 추출)

### ⚠️ Toss Storage loadAsync 타임아웃 필수

- **배경**: tomato-juice 운영 중 토스 WebView 초기화가 느리거나 Storage SDK가 무응답 상태에 빠지면, 기존 `loadFromTossStorage()`가 resolve되지 않아 게임이 "로딩 중" 화면에 영구적으로 멈췄다.
- **교훈**: `SaveManager`는 `loadTimeoutMs`(기본 5000) 옵션으로 Promise.race 타임아웃을 구현. 응답이 없으면 localStorage fallback으로 전환한다.
- **주의**: 타임아웃 fallback은 Toss Storage를 "비어있음"으로 해석하지 않는다. 다음 부팅에서 정상 응답이 오면 Toss Storage 값이 우선 복원되어야 한다(AP-LOAD-02).

### ⚠️ isLoaded 플래그 없이 save() 호출 시 Lv1 덮어쓰기 사고

- **배경**: 토스 WebView 초기화 중 `loadAsync()` 완료 전에 UI/튜토리얼 코드가 `save()`를 호출하면, 기본 초기 상태(Lv1)가 Toss Storage에 즉시 덮어써져 **기존 세이브가 전부 유실**됐다. 토마토농장 초기 운영에서 가장 비용이 컸던 사고.
- **교훈**: `SaveManager.isLoaded` 플래그는 `loadAsync()` resolve 후 true. `save()`/`saveAsync()`는 `isToss && !isLoaded`인 경우 **Toss Storage 쓰기를 스킵**하고 localStorage에만 기록.
- **회귀 보호**: `src/core/SaveManager.test.ts`의 AP-REGRESSION-02가 이 계약을 잠근다. 수정 후 `npm run test`로 반드시 검증.

### ⚠️ visibilitychange에서 save() 호출 금지

- **배경**: tomato-farm v2.93 직전, 토스 WebView의 visibilitychange 이벤트 순서가 "hidden → WebView freeze → hidden 이벤트 도착"으로 꼬이면서, `save()`가 자식 프로세스 context에서 호출돼 Storage 쓰기가 중간에 끊기는 사고 발생. 일부 유저 세이브가 부분 기록된 JSON으로 corruption.
- **교훈**: **SoundManager 및 main.ts의 visibilitychange 핸들러는 절대 SaveManager에 접근하지 않는다.** SoundManager는 BGM suspend/resume만 수행.
- **회귀 보호**: `SaveManager.visibility.test.ts`의 AP-SAVE-GUARD-02는 `src/platform/SoundManager.ts`를 정적으로 읽어 `SaveManager` 참조나 `saveAsync(` 호출이 있으면 실패한다. 누군가 편의상 `save()`를 추가하면 테스트가 막는다.

### 💡 공통 Toast 시스템 (ui/Toast.ts)

- **배경**: tomato-juice, tomato-farm 모두 각자 `showToast()`를 중복 구현. 큐 미구현 버전은 연속 알림 시 이전 토스트를 덮어쓰는 버그 존재.
- **교훈**: `src/ui/Toast.ts`에 큐 기반 단일 진입점 제공. CSS 클래스 `.app-toast` + `.app-toast.show` 만 프로젝트 전역 CSS에 정의하면 바로 사용 가능.
- **사용법**: `import { showToast } from './ui/Toast'; showToast('저장되었습니다', 2000);`

### 💡 AppContext DI 패턴 (app/AppContext.ts)

- **배경**: 씬마다 SaveManager, AdManager, SoundManager, ExitHandler를 개별 주입하는 보일러플레이트가 반복. 전역 싱글톤을 쓰면 테스트/샘플 빌드가 오염.
- **교훈**: `AppContext<TState, TScenes>` 제네릭 인터페이스로 의존성을 한 번에 묶어 씬 생성자에 전달. tomato-juice가 검증한 구조.
- **주의**: 템플릿은 제네릭만 제공한다. 구체 타입은 게임별로 `type MyCtx = AppContext<MyState, MySceneManager>` 로 구체화.

### 💡 레이아웃 토큰 (ui/layout-tokens.ts)

- **배경**: tomato-farm에서 씬마다 `top: 104`, `padding: 16`, `max-width: 380` 같은 매직 넘버가 반복. 한 곳 수정하면 다른 씬과 간격이 어긋남.
- **교훈**: `SAFE_TOP`, `HUD_HEIGHT`, `CONTENT_TOP`, `CARD_MAX_WIDTH`, `getCardWidth()` 등 상수/헬퍼를 토큰화. 씬 레이아웃 수정 시 토큰만 조정.

---

## Testing (v2.94 추가)

### Vitest 회귀 테스트 3종 (필수 실행)

game-template은 `vitest` + `jsdom`을 devDependency로 포함한다. 모든 백포트/수정 후 아래를 실행:

```bash
npm run test            # SaveManager.test.ts + SaveManager.visibility.test.ts
```

| 테스트 파일 | 보호 대상 | 깨지면 의미 |
|------------|----------|-----------|
| `SaveManager.test.ts` (AP-REGRESSION-01) | 토스 Storage 라운드트립 | Toss Storage 우선순위/쓰기 경로 회귀 |
| `SaveManager.test.ts` (AP-REGRESSION-02) | isLoaded 가드 | Lv1 덮어쓰기 사고 재발 가능 |
| `SaveManager.visibility.test.ts` (AP-REGRESSION-03) | visibilitychange 금지 | SoundManager/main.ts에 save() 호출 혼입
