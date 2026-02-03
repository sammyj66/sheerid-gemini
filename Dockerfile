FROM node:20-slim AS builder
WORKDIR /app

# 安装必要的构建工具
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# 设置构建时环境变量
ENV DATABASE_URL="file:./dev.db"

COPY package*.json ./
RUN npm ci --ignore-scripts
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app

# 安装运行时依赖
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
CMD ["node", "server.js"]
