#!/usr/bin/env bash
# Copy TELEGRAM_BOT_TOKEN (+ optional BALE_*) from local .env to production .env
# without printing secrets. Requires Host price-update-prod in ~/.ssh/config.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_ENV="$ROOT/.env"
HOST="${PRICE_UPDATE_SSH_HOST:-price-update-prod}"
REMOTE_DIR="/opt/apps/petrofoolad/price-update-system"

if [[ ! -f "$LOCAL_ENV" ]]; then
  echo "Missing local .env"
  exit 1
fi

python3 - "$LOCAL_ENV" <<'PY' > /tmp/price-update-bot-env.env
import sys
from pathlib import Path
vals = {}
for line in Path(sys.argv[1]).read_text().splitlines():
    s = line.strip()
    if not s or s.startswith("#") or "=" not in s:
        continue
    k, v = s.split("=", 1)
    vals[k.strip()] = v.strip().strip("\"'")
keys = [
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_BOT_API_BASE_URL",
    "BALE_BOT_TOKEN",
    "BALE_API_BASE_URL",
]
missing = [k for k in ("TELEGRAM_BOT_TOKEN", "BALE_BOT_TOKEN") if not vals.get(k)]
if missing:
    raise SystemExit(f"Local .env missing required keys: {', '.join(missing)}")
for k in keys:
    v = vals.get(k, "")
    if not v and k.endswith("_API_BASE_URL"):
        continue
    if v:
        print(f"{k}={v}")
PY

echo "Syncing bot keys to $HOST:$REMOTE_DIR/.env (values not printed)..."
scp -q /tmp/price-update-bot-env.env "$HOST:/tmp/price-update-bot-env.env"
ssh -o BatchMode=yes "$HOST" bash -s <<REMOTE
set -euo pipefail
cd "$REMOTE_DIR"
python3 - <<'PY'
from pathlib import Path
env_path = Path(".env")
incoming = {}
for line in Path("/tmp/price-update-bot-env.env").read_text().splitlines():
    if "=" in line:
        k, v = line.split("=", 1)
        incoming[k.strip()] = v.strip()
text = env_path.read_text() if env_path.exists() else ""
lines = text.splitlines()
keys_seen = set()
out = []
for line in lines:
    if not line.strip() or line.strip().startswith("#") or "=" not in line:
        out.append(line)
        continue
    k = line.split("=", 1)[0].strip()
    if k in incoming:
        out.append(f"{k}={incoming[k]}")
        keys_seen.add(k)
    else:
        out.append(line)
for k, v in incoming.items():
    if k not in keys_seen:
        out.append(f"{k}={v}")
env_path.write_text("\n".join(out) + "\n")
print("updated keys:", ", ".join(sorted(incoming)))
PY
rm -f /tmp/price-update-bot-env.env
REMOTE
rm -f /tmp/price-update-bot-env.env
echo "Done. Redeploy with: ssh $HOST 'cd $REMOTE_DIR && docker compose up -d --build'"
