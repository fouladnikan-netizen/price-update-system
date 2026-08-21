#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PGDATA="${PGDATA:-$ROOT/.local/postgres}"
LOG="$ROOT/.local/postgres.log"
export PATH="/opt/homebrew/opt/postgresql@16/bin:/opt/homebrew/opt/postgresql@18/bin:/opt/homebrew/opt/libpq/bin:$PATH"
export LC_ALL="${LC_ALL:-C}"
export LANG="${LANG:-C}"

if ! command -v postgres >/dev/null 2>&1; then
  echo "PostgreSQL server binary is not installed. Need brew install postgresql@16 (or Docker)." >&2
  exit 3
fi

mkdir -p "$ROOT/.local"
if [[ ! -f "$PGDATA/PG_VERSION" ]]; then
  initdb -D "$PGDATA" --locale=C --encoding=UTF8 --username=price_update --auth-local=trust --auth-host=trust
fi

if ! pg_ctl -D "$PGDATA" status >/dev/null 2>&1; then
  pg_ctl -D "$PGDATA" -l "$LOG" -o "-p 5432 -k $ROOT/.local" start
fi

for _ in $(seq 1 30); do
  if pg_isready -h 127.0.0.1 -p 5432 -U price_update >/dev/null 2>&1; then
    break
  fi
  sleep 0.3
done

EXISTS="$(psql -h 127.0.0.1 -U price_update -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'price_update'")"
if [[ "$EXISTS" != "1" ]]; then
  createdb -h 127.0.0.1 -U price_update price_update
fi

echo "local postgres is ready"
