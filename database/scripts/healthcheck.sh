#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$ROOT/.env"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

export PATH="/opt/homebrew/opt/postgresql@16/bin:/opt/homebrew/opt/postgresql@18/bin:/opt/homebrew/opt/libpq/bin:$PATH"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set" >&2
  exit 2
fi

echo "Health check: $DATABASE_URL"
pg_isready -d "$DATABASE_URL"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "SELECT current_database() AS database, current_user AS db_user, now() AS server_time;"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "SELECT id FROM schema_migrations ORDER BY applied_at;"
echo "database health: pass"
