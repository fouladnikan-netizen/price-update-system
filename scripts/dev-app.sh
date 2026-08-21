#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cleanup() {
  trap - EXIT INT TERM
  kill 0 2>/dev/null || true
}
trap cleanup EXIT INT TERM

(cd "$ROOT/apps/api" && exec ./node_modules/.bin/tsx watch src/server.ts) &
(cd "$ROOT/apps/web" && exec ./node_modules/.bin/vite --host 127.0.0.1 --port 5173) &

echo "API:  http://127.0.0.1:8787"
echo "صفحه: http://127.0.0.1:5173/"
wait
