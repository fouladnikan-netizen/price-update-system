FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy manifests first so dependency layers cache when only app code changes.
COPY apps/web/package.json apps/web/package-lock.json ./apps/web/
COPY apps/api/package.json apps/api/package-lock.json ./apps/api/

WORKDIR /app/apps/web
RUN npm config set fetch-retries 5 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 180000 \
  && npm config set fetch-timeout 600000 \
  && npm ci

WORKDIR /app/apps/api
RUN npm config set fetch-retries 5 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 180000 \
  && npm config set fetch-timeout 600000 \
  && npm ci

# App source + catalog after deps (faster rebuilds when only code changes).
WORKDIR /app
COPY . .

WORKDIR /app/apps/web
RUN npm run build

ENV AI_API_HOST=0.0.0.0
ENV AI_API_PORT=8787
ENV PRICE_UPDATE_STATIC_DIR=/app/apps/web/dist

EXPOSE 8787
WORKDIR /app/apps/api
CMD ["./node_modules/.bin/tsx", "src/server.ts"]
