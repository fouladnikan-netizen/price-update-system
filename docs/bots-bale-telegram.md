# Bale & Telegram bots — same contract on local, GitHub, and production

## Rule

- **Bale** = `BALE_BOT_TOKEN` → `@nikan_price_collector_bot` → polled inside `price-update-app`
- **Telegram** = `TELEGRAM_BOT_TOKEN` → `@price_update_nikan_bot` → `price-update-telegram-bot` worker
- Never put a Bale token in `TELEGRAM_BOT_TOKEN` or a Telegram token in `BALE_BOT_TOKEN`

## Required `.env` keys (all environments)

```text
BALE_BOT_TOKEN=
BALE_API_BASE_URL=https://tapi.bale.ai
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_API_BASE_URL=https://api.telegram.org
```

Do not commit real tokens. GitHub only has placeholders in `.env.example`.

## Local

```bash
cp .env.example .env   # fill tokens once
cd apps/api && npm run bale:check
cd apps/api && npm run telegram-bot:health
# main API (includes Bale inbox poller when BALE_BOT_TOKEN is set)
cd apps/api && npm run dev
# Telegram worker in a second terminal
cd apps/api && npm run telegram-bot:worker
```

Or with Docker:

```bash
docker compose up -d --build
```

## Production (`price-update-prod`)

Path: `/opt/apps/petrofoolad/price-update-system`

1. Ensure production `.env` has the same bot keys as local (tokens never in git).
2. `docker compose up -d --build`
3. Containers: `price-update-app`, `price-update-telegram-bot`, `price-update-postgres`
4. Verify:

```bash
docker exec price-update-app sh -c 'cd /app/apps/api && ./node_modules/.bin/tsx src/bale-check.ts'
docker logs price-update-telegram-bot --tail 20
```

Expected:

- Bale: `بازوی بله وصل است: @nikan_price_collector_bot`
- Telegram: `telegram bot worker listening as @price_update_nikan_bot`

## Health API

`GET /api/health` (after login) reports:

- `baleConfigured` / `baleConnected` / `baleBotUsername`
- `telegramBotConfigured` / `telegramBotConnected` / `telegramBotUsername`
