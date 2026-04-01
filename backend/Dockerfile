# Production API image for Azure Container Apps (also usable locally / other hosts).
FROM node:20-bookworm-slim
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma/
COPY MockConfigs ./MockConfigs/
RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src/
RUN npx prisma generate && npm run build && npm prune --omit=dev

ENV NODE_ENV=production
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
