#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

npm ci
npm run build:protocol
npm run build:desktop

cd desktop
if [[ "${1:-}" == "--package" ]]; then
  npm run package
  echo "桌面安装包输出目录: desktop/release/"
fi
