#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/android"

if [[ -z "${ANDROID_HOME:-}" ]]; then
  if [[ -d "$HOME/android-sdk" ]]; then
    export ANDROID_HOME="$HOME/android-sdk"
  elif [[ -d "/opt/android-sdk" ]]; then
    export ANDROID_HOME="/opt/android-sdk"
  else
    echo "未找到 ANDROID_HOME，请先运行 scripts/setup-android-sdk.sh"
    exit 1
  fi
fi

export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

chmod +x ./gradlew
./gradlew assembleDebug --no-daemon
echo "Debug APK: android/app/build/outputs/apk/debug/app-debug.apk"
