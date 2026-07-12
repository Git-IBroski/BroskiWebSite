# ── Build stage ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Production stage ────────────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app

# Copia solo ciò che serve a runtime
COPY --from=builder /app/dist          ./dist
COPY --from=builder /app/public        ./public
COPY --from=builder /app/server.cjs    ./
COPY --from=builder /app/package*.json ./

# Installa solo le dipendenze di produzione (express compreso)
RUN npm ci --omit=dev

EXPOSE 3000
CMD ["node", "server.cjs"]
