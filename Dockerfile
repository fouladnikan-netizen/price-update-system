FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

WORKDIR /app/apps/web
RUN npm ci && npm run build

WORKDIR /app/apps/api
RUN npm ci

ENV AI_API_HOST=0.0.0.0
ENV AI_API_PORT=8787
ENV PRICE_UPDATE_STATIC_DIR=/app/apps/web/dist

EXPOSE 8787
WORKDIR /app/apps/api
CMD ["./node_modules/.bin/tsx", "src/server.ts"]
