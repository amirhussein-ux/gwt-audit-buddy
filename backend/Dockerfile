FROM node:20-slim AS deps

RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
    libdrm2 libdbus-1-3 libxkbcommon0 libxcomposite1 libxdamage1 \
    libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 \
    libasound2 fonts-liberation fonts-noto-color-emoji \
    ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY backend/package*.json ./

# ✅ Fix 1: Install ALL deps first (including devDeps so playwright CLI is available)
RUN npm ci
RUN npx playwright install chromium --with-deps

# ✅ Then prune dev deps after browser is installed
RUN npm prune --omit=dev

COPY backend/ .

FROM node:20-slim AS runner

RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
    libdrm2 libdbus-1-3 libxkbcommon0 libxcomposite1 libxdamage1 \
    libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 \
    libasound2 fonts-liberation fonts-noto-color-emoji ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ✅ Fix 2: Create user and dirs BEFORE copying files, so chown is clean
RUN useradd --create-home --shell /bin/bash appuser \
  && mkdir -p /ms-playwright \
  && chmod 755 /ms-playwright

COPY --from=deps /app /app
COPY --from=deps /ms-playwright /ms-playwright

# ✅ Single chown after all files are in place
RUN chown -R appuser:appuser /app /ms-playwright

USER appuser

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV NODE_ENV=production

EXPOSE 10000

CMD ["node", "/app/src/server.js"]