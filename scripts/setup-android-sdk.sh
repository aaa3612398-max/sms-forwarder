#!/usr/bin/env bash
set -euo pipefail

SDK_ROOT="${ANDROID_HOME:-$HOME/android-sdk}"
mkdir -p "$SDK_ROOT/cmdline-tools"
TMP="$(mktemp -d)"
cd "$TMP"

if [[ ! -d "$SDK_ROOT/cmdline-tools/latest" ]]; then
  wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O cmdtools.zip
  unzip -q cmdtools.zip
  rm -rf "$SDK_ROOT/cmdline-tools/latest"
  mv cmdline-tools "$SDK_ROOT/cmdline-tools/latest"
fi

export ANDROID_HOME="$SDK_ROOT"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

yes | sdkmanager --licenses >/dev/null || true
sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"

echo "ANDROID_HOME=$SDK_ROOT"
if [[ -n "${GITHUB_ENV:-}" ]]; then
  echo "ANDROID_HOME=$SDK_ROOT" >> "$GITHUB_ENV"
  echo "PATH=$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH" >> "$GITHUB_ENV"
fi
