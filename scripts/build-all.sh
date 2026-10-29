#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

npm ci
npm run build:protocol
npm run test:protocol
npm run test:e2e

if [[ -x "$ROOT/android/gradlew" ]]; then
  bash "$ROOT/scripts/build-android.sh"
fi

npm run build:desktop

echo "全部构建完成"
