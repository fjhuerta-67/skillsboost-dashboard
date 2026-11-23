# ==========================================
# Stage 1: Build Frontend SPA (Vite + React)
# ==========================================
FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY index.html tsconfig.json vite.config.ts ./
COPY public ./public
COPY src ./src

RUN npm run build

# ==========================================
# Stage 2: Lean Cloud Run Service & Job Runtime
# ==========================================
FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV APP_ENV=cloud
ENV PORT=8080

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY tsconfig.json server.ts ./
COPY src ./src
COPY scripts ./scripts
COPY bigquery ./bigquery
COPY README.md ./README.md
COPY docs/manuales ./docs/manuales

# Prepare writable fallback directory for non-root container user
RUN mkdir -p /app/.data && chown -R node:node /app

USER node

EXPOSE 8080

CMD ["./node_modules/.bin/tsx", "server.ts"]
