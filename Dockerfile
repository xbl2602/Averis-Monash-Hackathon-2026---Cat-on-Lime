# 用 Next.js "standalone" 输出模式打包，产物小、依赖已经打包好。
# 用法见 README.md "Docker 部署"部分。

FROM node:20-slim AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/data ./data

EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
