#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f "$ROOT/.env" ]]; then
  echo "Create .env from .env.example first." >&2
  exit 2
fi

export AI_API_HOST="${AI_API_HOST:-0.0.0.0}"
export AI_API_PORT="${AI_API_PORT:-8787}"
export PRICE_UPDATE_STATIC_DIR="${PRICE_UPDATE_STATIC_DIR:-$ROOT/apps/web/dist}"

(cd "$ROOT/apps/web" && npm ci && npm run build)
(cd "$ROOT/apps/api" && npm ci)
(cd "$ROOT/apps/api" && ./node_modules/.bin/tsx src/migrate.ts)
echo "page+api: http://${AI_API_HOST}:${AI_API_PORT}/"
exec "$ROOT/apps/api/node_modules/.bin/tsx" "$ROOT/apps/api/src/server.ts"
