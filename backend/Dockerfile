FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates chromium fonts-liberation libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libgbm1 libnss3 libxcomposite1 libxdamage1 libxrandr2 \
    libxkbcommon0 libpango-1.0-0 libasound2 \
    && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["sh", "-c", "\
  PRISMA=node_modules/.bin/prisma; \
  $PRISMA migrate resolve --applied 20260404120000_imager_output_language 2>/dev/null || true; \
  $PRISMA migrate resolve --applied 20260404120001_add_cancelled_job_status 2>/dev/null || true; \
  $PRISMA migrate deploy && node dist/src/index.js \
"]
