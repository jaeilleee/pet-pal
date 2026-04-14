#!/usr/bin/env bash
# release.sh — 3종 배포 자동화 (웹 + APK + 토스 .ait)
#
# 치환 변수 (새 게임 생성 시 아래를 실제 값으로 교체):
#   __VERCEL_ALIAS__   — Vercel alias 도메인  (예: my-game.vercel.app)
#   __TELEGRAM_CHAT__  — 텔레그램 chat_id     (예: 8015335893)
#   __GAME_ID__        — 게임 ID (APK 파일명용, 예: tomato-farm)
#
# 사용법:
#   bash scripts/release.sh --help
#   bash scripts/release.sh --dry-run --all
#   bash scripts/release.sh --web
#   bash scripts/release.sh --apk
#   bash scripts/release.sh --ait
#   bash scripts/release.sh --all
#   bash scripts/release.sh --bump minor --all

set -euo pipefail

# ---------------------------------------------------------------------------
# 상수 / 설정
# ---------------------------------------------------------------------------
VERCEL_ALIAS="pet-pal-game.vercel.app"
TELEGRAM_CHAT="8015335893"
GAME_ID="pet-pal"

# Android 관련 경로 (Capacitor 기본 구조)
ANDROID_DIR="android"
GRADLE_WRAPPER="${ANDROID_DIR}/gradlew"
BUILD_GRADLE="${ANDROID_DIR}/app/build.gradle"
APK_OUTPUT="${ANDROID_DIR}/app/build/outputs/apk/release"

# ---------------------------------------------------------------------------
# 색상 출력 헬퍼
# ---------------------------------------------------------------------------
_info()  { printf '[INFO]  %s\n' "$*"; }
_step()  { printf '[STEP]  %s\n' "$*"; }
_dry()   { printf '[DRY]   %s\n' "$*"; }
_ok()    { printf '[OK]    %s\n' "$*"; }
_err()   { printf '[ERROR] %s\n' "$*" >&2; }

# ---------------------------------------------------------------------------
# 사용법
# ---------------------------------------------------------------------------
usage() {
  cat <<'EOF'
Usage: bash scripts/release.sh [OPTIONS]

배포 대상:
  --web          웹만 배포 (Vercel)
  --apk          APK만 빌드 + 배포 (Google Drive + 텔레그램)
  --ait          토스 .ait만 빌드
  --all          3종 동시 배포 (권장)

버전:
  --bump patch   패치 버전 증가 (기본값)
  --bump minor   마이너 버전 증가
  --bump major   메이저 버전 증가

기타:
  --dry-run      실제 명령 실행 없이 echo만 출력
  --help         이 도움말 출력

예시:
  bash scripts/release.sh --dry-run --all
  bash scripts/release.sh --bump minor --all
  bash scripts/release.sh --web

주의:
  1. ait build가 dist/ 폴더를 덮어쓰므로 ait → npm run build 순서를 지킨다.
  2. APK 빌드 전 versionCode/versionName을 반드시 올린다 (동일 버전 설치 충돌).
  3. --all 시 순서: bump → ait → web build → vercel → android → rclone → telegram
EOF
}

# ---------------------------------------------------------------------------
# 플래그 파싱
# ---------------------------------------------------------------------------
DO_WEB=false
DO_APK=false
DO_AIT=false
DO_ALL=false
DRY_RUN=false
BUMP_TYPE="patch"

if [ "$#" -eq 0 ]; then
  usage
  exit 0
fi

while [ "$#" -gt 0 ]; do
  case "$1" in
    --help)    usage; exit 0 ;;
    --web)     DO_WEB=true ;;
    --apk)     DO_APK=true ;;
    --ait)     DO_AIT=true ;;
    --all)     DO_ALL=true ;;
    --dry-run) DRY_RUN=true ;;
    --bump)
      shift
      BUMP_TYPE="${1:-patch}"
      if [ "$BUMP_TYPE" != "patch" ] && [ "$BUMP_TYPE" != "minor" ] && [ "$BUMP_TYPE" != "major" ]; then
        _err "--bump 값은 patch|minor|major 중 하나여야 합니다."
        exit 1
      fi
      ;;
    *)
      _err "알 수 없는 옵션: $1"
      usage
      exit 1
      ;;
  esac
  shift
done

# --all 시 3종 모두 활성
if $DO_ALL; then
  DO_WEB=true
  DO_APK=true
  DO_AIT=true
fi

# 아무것도 선택 안 했을 때
if ! $DO_WEB && ! $DO_APK && ! $DO_AIT; then
  _err "배포 대상을 지정하세요: --web, --apk, --ait, --all"
  usage
  exit 1
fi

# ---------------------------------------------------------------------------
# run 헬퍼 — dry-run 시 echo만, 그 외 실제 실행
# ---------------------------------------------------------------------------
run() {
  if $DRY_RUN; then
    _dry "$*"
  else
    _step "$*"
    eval "$*"
  fi
}

# ---------------------------------------------------------------------------
# 버전 bump 함수
# ---------------------------------------------------------------------------
bump_version() {
  local bump="$1"

  # package.json에서 현재 버전 읽기
  local current_version
  current_version=$(grep '"version"' package.json | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/')

  # IFS 분리
  local major minor patch
  major=$(printf '%s' "$current_version" | cut -d. -f1)
  minor=$(printf '%s' "$current_version" | cut -d. -f2)
  patch=$(printf '%s' "$current_version" | cut -d. -f3)

  case "$bump" in
    major) major=$((major + 1)); minor=0; patch=0 ;;
    minor) minor=$((minor + 1)); patch=0 ;;
    patch) patch=$((patch + 1)) ;;
  esac

  local new_version="${major}.${minor}.${patch}"

  if $DRY_RUN; then
    _dry "bump version: ${current_version} → ${new_version} (versionCode +1, versionName ${new_version})"
  else
    _step "버전 bump: ${current_version} → ${new_version}"

    # package.json 업데이트
    # macOS/BSD sed 호환 (-i '' 사용)
    sed -i '' "s/\"version\": \"${current_version}\"/\"version\": \"${new_version}\"/" package.json

    # build.gradle 존재 시 업데이트
    if [ -f "$BUILD_GRADLE" ]; then
      # versionCode: 기존 값 +1
      local old_code
      old_code=$(grep 'versionCode' "$BUILD_GRADLE" | head -1 | grep -o '[0-9]*')
      local new_code=$((old_code + 1))
      sed -i '' "s/versionCode ${old_code}/versionCode ${new_code}/" "$BUILD_GRADLE"
      sed -i '' "s/versionName \"[^\"]*\"/versionName \"${new_version}\"/" "$BUILD_GRADLE"
      _ok "build.gradle: versionCode ${old_code} → ${new_code}, versionName → ${new_version}"
    fi

    _ok "package.json: version → ${new_version}"
  fi

  # APK 파일명용으로 새 버전을 환경변수에 저장
  NEW_VERSION="${new_version}"
}

# ---------------------------------------------------------------------------
# 단계 함수
# ---------------------------------------------------------------------------

# 단계 1: 버전 bump
step_bump() {
  bump_version "$BUMP_TYPE"
}

# 단계 2: 토스 .ait 빌드
step_ait_build() {
  run "npx ait build"
}

# 단계 3: 웹 빌드 (ait가 dist 덮어쓰므로 반드시 재빌드)
step_web_build() {
  run "npm run build"
}

# 단계 4: Vercel 배포
step_vercel_deploy() {
  if $DRY_RUN; then
    _dry "vercel deploy --prod --yes"
    VERCEL_URL="https://placeholder-${GAME_ID}.vercel.app"
  else
    _step "vercel deploy --prod --yes"
    VERCEL_URL=$(vercel deploy --prod --yes 2>&1 | tail -1)
    _ok "배포 URL: ${VERCEL_URL}"
  fi
}

# 단계 5: Vercel alias 설정
step_vercel_alias() {
  if $DRY_RUN; then
    _dry "vercel alias set <deployment-url> ${VERCEL_ALIAS}"
  else
    _step "vercel alias set ${VERCEL_URL} ${VERCEL_ALIAS}"
    vercel alias set "${VERCEL_URL}" "${VERCEL_ALIAS}"
    _ok "alias 설정 완료: ${VERCEL_ALIAS}"
  fi
}

# 단계 6: Capacitor android sync
step_cap_sync() {
  run "npx cap sync android"
}

# 단계 7: Android APK 빌드
step_gradlew() {
  if $DRY_RUN; then
    _dry "./gradlew assembleRelease (in ${ANDROID_DIR}/)"
  else
    _step "./gradlew assembleRelease"
    (cd "${ANDROID_DIR}" && ./gradlew assembleRelease)
    _ok "APK 빌드 완료"
  fi
}

# 단계 8: APK 파일명 변경
step_apk_rename() {
  local apk_name="${GAME_ID}-v${NEW_VERSION:-0.0.0}.apk"
  if $DRY_RUN; then
    _dry "APK rename: app-release.apk → ${apk_name}"
  else
    local src="${APK_OUTPUT}/app-release.apk"
    local dst="${APK_OUTPUT}/${apk_name}"
    if [ -f "$src" ]; then
      mv "$src" "$dst"
      _ok "APK 이름 변경: ${apk_name}"
    else
      _err "APK 파일을 찾을 수 없음: ${src}"
      exit 1
    fi
    APK_PATH="$dst"
  fi
}

# 단계 9: rclone으로 Google Drive 업로드 + 공유 링크 획득
step_rclone() {
  local apk_name="${GAME_ID}-v${NEW_VERSION:-0.0.0}.apk"
  if $DRY_RUN; then
    _dry "rclone copy ${APK_OUTPUT}/${apk_name} gdrive:/ --progress"
    _dry "rclone link gdrive:/${apk_name}"
    DRIVE_LINK="https://drive.google.com/file/d/placeholder/view"
  else
    _step "rclone copy ${APK_PATH} gdrive:/ --progress"
    rclone copy "${APK_PATH}" gdrive:/ --progress
    _step "rclone link gdrive:/${apk_name}"
    DRIVE_LINK=$(rclone link "gdrive:/${apk_name}")
    _ok "Drive 링크: ${DRIVE_LINK}"
  fi
}

# 단계 10: 텔레그램으로 다운로드 링크 전송
step_telegram() {
  local msg="${GAME_ID} 새 빌드 v${NEW_VERSION:-0.0.0}\\n${DRIVE_LINK:-https://placeholder}"
  if $DRY_RUN; then
    _dry "telegram send (chat_id: ${TELEGRAM_CHAT}): ${GAME_ID} 새 빌드 링크"
  else
    # TELEGRAM_BOT_TOKEN은 환경 변수로 주입받는다 (.env 또는 CI secret)
    if [ -z "${TELEGRAM_BOT_TOKEN:-}" ]; then
      _err "TELEGRAM_BOT_TOKEN 환경 변수가 필요합니다. export TELEGRAM_BOT_TOKEN=... 후 재실행."
      exit 1
    fi
    _step "텔레그램 전송 → chat_id: ${TELEGRAM_CHAT}"
    curl -s -X POST \
      "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      --data-urlencode "chat_id=${TELEGRAM_CHAT}" \
      --data-urlencode "text=${msg}" \
      > /dev/null
    _ok "텔레그램 전송 완료"
  fi
}

# ---------------------------------------------------------------------------
# 메인 실행
# ---------------------------------------------------------------------------
NEW_VERSION="0.0.0"
VERCEL_URL=""
DRIVE_LINK=""
APK_PATH=""

_info "배포 시작 (dry=${DRY_RUN}, web=${DO_WEB}, apk=${DO_APK}, ait=${DO_AIT}, bump=${BUMP_TYPE})"

# ----- 1. 버전 bump (항상 먼저) -----
step_bump

# ----- AIT 섹션 -----
if $DO_AIT; then
  # ----- 2. ait build -----
  step_ait_build
fi

# ----- WEB 섹션 -----
if $DO_WEB; then
  # ----- 3. npm run build (ait 이후 재빌드 — dist 덮어쓰기 복원) -----
  step_web_build

  # ----- 4. vercel deploy -----
  step_vercel_deploy

  # ----- 5. vercel alias set -----
  step_vercel_alias
fi

# ----- APK 섹션 -----
if $DO_APK; then
  # ----- 6. npx cap sync android -----
  step_cap_sync

  # ----- 7. gradlew assembleRelease -----
  step_gradlew

  # ----- 8. APK rename -----
  step_apk_rename

  # ----- 9. rclone copy + link -----
  step_rclone

  # ----- 10. telegram send -----
  step_telegram
fi

# TODO(ios): iOS 배포 단계 — EAS Submit 또는 Xcode Archive 필요
# TODO(ios): npx eas build --platform ios --profile production
# TODO(ios): npx eas submit --platform ios
# TODO(ios): 현재 Android/Toss/Web만 지원

_info "배포 완료."
