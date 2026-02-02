# Phase 1: 后端核心模块

## 目标
实现后端核心逻辑：Prisma 客户端、上游 API 封装、卡密业务逻辑、验证任务管理。

## 文件清单

### 1. src/lib/db.ts - Prisma 客户端单例
```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
```

### 2. src/lib/validation.ts - verificationId 校验
```typescript
const VALID_ID_REGEX = /^(69|6a)[a-fA-F0-9]{22}$/i;

export function validateVerificationId(id: string): string | null {
  if (!id || id.length !== 24) return "长度必须为24位";
  if (!/^[a-fA-F0-9]+$/.test(id)) return "必须是十六进制字符";
  if (!/^(69|6a)/i.test(id)) return "前缀不合法（仅支持69或6a开头）";
  return null;
}

export function extractVerificationId(input: string): string | null {
  // 从 URL 参数提取
  const urlMatch = input.match(/verificationId=([a-fA-F0-9]+)/);
  if (urlMatch) return urlMatch[1];
  // 从路径提取
  const pathMatch = input.match(/\/([a-fA-F0-9]{24,})/);
  if (pathMatch) return pathMatch[1];
  // 纯 ID
  if (/^[a-fA-F0-9]{24,}$/.test(input)) return input;
  return null;
}
```

### 3. src/lib/upstream.ts - neigui.1key.me API 封装
功能要求：
- `getCsrfToken()` - 从 neigui.1key.me 获取 CSRF Token
- `submitBatchVerification(ids: string[], cdk: string)` - 提交批量验证，返回 SSE 流
- `checkPendingStatus(checkToken: string)` - 查询 pending 状态
- `parseSSEStream(stream: ReadableStream)` - 解析 SSE 事件流
- 60 秒总超时
- SSE 事件类型：`processing` → `pending` → `result`
- 断线后使用 checkToken 回落到 `/api/check-status` 轮询

关键参数：
```typescript
const UPSTREAM_BASE = 'https://neigui.1key.me';
const CDK = process.env.UPSTREAM_CDK;

// POST /api/batch
// Body: { verificationIds: string[], hCaptchaToken: CDK, programId: 'google-student' }
// Headers: { 'X-CSRF-Token': csrfToken }
// Response: text/event-stream
```

### 4. src/lib/cardkey.ts - 卡密业务逻辑
功能要求：
- `generateKeys(count: number, options?: { expiresAt?: Date, note?: string, batchNo?: string })` - 批量生成卡密
- `lockKey(code: string, jobId: string)` - 锁定卡密（状态 UNUSED → LOCKED）
- `consumeKey(code: string)` - 消耗卡密（状态 LOCKED → CONSUMED）
- `unlockKey(code: string)` - 释放卡密（状态 LOCKED → UNUSED，用于失败回滚）
- `revokeKey(code: string)` - 作废卡密
- `getKeyByCode(code: string)` - 查询卡密

卡密格式：使用 nanoid 生成 16 位随机码

### 5. src/lib/verification.ts - 验证任务逻辑
功能要求：
- `createVerificationJob(sheeridUrl: string, cardKeyCode: string)` - 创建任务
- `processVerification(jobId: string)` - 执行验证流程
- `handleVerificationResult(jobId: string, result: VerificationResult)` - 处理结果
- `checkDuplicateVerification(verificationId: string)` - 查询是否已验证过（去重）

业务规则：
- 同一 verificationId 只允许一个活跃任务
- 成功时：消耗卡密，记录 resultUrl
- 失败/超时时：回滚卡密状态
- 60 秒无结果标记为 TIMEOUT

## API 路由

### 6. src/app/api/verify/route.ts - 用户验证接口
```typescript
// POST /api/verify
// Body: { links: string[], cardKeys: string[] }
// Response: text/event-stream (SSE)
```

### 7. src/app/api/query/route.ts - 历史查询接口
```typescript
// POST /api/query
// Body: { cardKey?: string, verificationId?: string }
// Response: { found: boolean, status?, resultUrl?, verifiedAt?, cardKeyCode? }
```

### 8. src/app/api/stats/route.ts - 统计接口
```typescript
// GET /api/stats
// Response: { todaySuccess: number, todayFail: number, todayTotal: number }
```

## 验收标准
- [ ] `npm run build` 无错误
- [ ] 可通过 API 生成卡密
- [ ] 可通过 API 发起验证（使用模拟数据测试）
- [ ] 去重逻辑正确：已验证的 verificationId 直接返回历史结果
