#!/usr/bin/env bash
# init-android.sh — Capacitor Android 초기 설정
#
# 신규 게임 생성 시 1회만 실행. 이미 android/ 디렉토리가 있다면 불필요.
#
# 사용법:
#   bash scripts/init-android.sh

set -euo pipefail

echo "[INIT] Capacitor Android 플랫폼 추가 중..."

# @capacitor/android 설치 (없을 경우)
if ! npm list @capacitor/android --depth=0 > /dev/null 2>&1; then
  echo "[INIT] @capacitor/android 설치..."
  npm install @capacitor/android
fi

# capacitor add android
npx cap add android

echo "[INIT] android/ 디렉토리 생성 완료."
echo "[INFO] 다음 단계:"
echo "  1. android/app/build.gradle — versionCode, versionName, applicationId 설정"
echo "  2. release keystore 생성 또는 기존 keystore 배치"
echo "  3. android/app/google-services.json 추가 (AdMob 사용 시)"
echo "  4. bash scripts/release.sh --dry-run --apk  # 배포 미리보기"
