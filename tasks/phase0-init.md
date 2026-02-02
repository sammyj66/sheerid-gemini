# Phase 0: 项目初始化

## 目标
初始化 Next.js 项目，配置 Prisma 数据库，安装依赖。

## 步骤

### 1. 创建 Next.js 项目
```bash
npx -y create-next-app@latest ./ --typescript --tailwind=false --eslint --app --src-dir --import-alias="@/*" --use-npm
```

### 2. 安装依赖
```bash
npm install prisma @prisma/client nanoid swr
npm install -D @types/node
```

### 3. 初始化 Prisma
```bash
npx prisma init --datasource-provider sqlite
```

### 4. 创建 Prisma Schema
文件: `prisma/schema.prisma`
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model CardKey {
  id           String    @id @default(cuid())
  code         String    @unique
  status       CardStatus @default(UNUSED)
  batchNo      String?
  note         String?
  createdAt    DateTime  @default(now())
  expiresAt    DateTime?
  consumedAt   DateTime?
  consumedBy   String?
  lockedAt     DateTime?
  lockJobId    String?
  
  verificationJobs VerificationJob[]
}

model VerificationJob {
  id              String    @id @default(cuid())
  sheeridUrl      String
  verificationId  String?
  cardKeyCode     String
  status          JobStatus @default(QUEUED)
  resultMessage   String?
  resultUrl       String?
  errorCode       String?
  upstreamReqId   String?
  startedAt       DateTime?
  finishedAt      DateTime?
  durationMs      Int?
  createdAt       DateTime  @default(now())
  
  cardKey         CardKey   @relation(fields: [cardKeyCode], references: [code])
  
  @@index([verificationId])
}

model DailyStats {
  id           String   @id @default(cuid())
  date         String   @unique
  successCount Int      @default(0)
  failCount    Int      @default(0)
  totalCount   Int      @default(0)
}

enum CardStatus {
  UNUSED
  LOCKED
  CONSUMED
  REVOKED
  EXPIRED
}

enum JobStatus {
  QUEUED
  PROCESSING
  PENDING
  SUCCESS
  FAIL
  ERROR
  TIMEOUT
}
```

### 5. 配置环境变量
文件: `.env`
```env
DATABASE_URL="file:./dev.db"
UPSTREAM_CDK="your_cdk_here"
ADMIN_PASSWORD="your_secure_password"
TZ="Asia/Shanghai"
```

### 6. 生成 Prisma Client 并迁移
```bash
npx prisma migrate dev --name init
```

### 7. 创建 .gitignore 规则
确保 `.gitignore` 包含:
```
.env
.env.local
*.db
```

## 验收标准
- [ ] Next.js 项目可运行 `npm run dev`
- [ ] Prisma 数据库已创建 `prisma/dev.db`
- [ ] 运行 `npx prisma studio` 可查看数据库表
