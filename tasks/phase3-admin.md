# Phase 3: 管理员模块

## 目标
实现管理员认证和卡密管理功能。

## 安全要求
- 登录速率限制（防爆破）
- 会话过期策略
- 操作审计日志

## 文件清单

### 1. src/app/api/admin/login/route.ts - 管理员登录
```typescript
// POST /api/admin/login
// Body: { password: string }
// Response: { success: boolean, token?: string }

// 安全措施：
// - 密码从 process.env.ADMIN_PASSWORD 读取
// - 速率限制：每 IP 每分钟最多 5 次尝试
// - 返回 JWT 或设置 httpOnly cookie
```

### 2. src/app/api/admin/keys/route.ts - 卡密管理 CRUD
```typescript
// GET /api/admin/keys?status=...&page=...&limit=...
// Response: { keys: CardKey[], total: number, page: number }

// POST /api/admin/keys
// Body: { count: number, expiresAt?: string, note?: string }
// Response: { keys: string[] }

// DELETE /api/admin/keys/[code]
// Response: { success: boolean }

// PATCH /api/admin/keys/[code]
// Body: { action: 'revoke' }
// Response: { success: boolean }
```

### 3. src/middleware.ts - 管理员路由保护
```typescript
// 保护 /api/admin/* 路由
// 验证 Authorization header 或 cookie
// 未认证返回 401
```

### 4. src/app/admin/page.tsx - 管理员登录页
功能：
- 密码输入框
- 登录按钮
- 错误提示
- 登录成功后跳转到 /admin/dashboard

### 5. src/app/admin/dashboard/page.tsx - 管理员仪表盘
功能：
- 卡密生成器
- 卡密列表（带筛选、分页）
- 快捷统计数据

### 6. src/components/admin/KeyGenerator.tsx - 卡密生成器
功能：
- 数量输入 (1-100)
- 可选过期时间
- 可选备注/批次号
- 生成按钮
- 生成结果展示（可复制、可导出）

### 7. src/components/admin/KeyTable.tsx - 卡密列表
功能：
- 状态筛选下拉框 (全部/未使用/已锁定/已消耗/已作废/已过期)
- 搜索框（按卡密/批次号搜索）
- 分页
- 每行操作：查看详情、作废、删除
- 实时刷新按钮

### 8. src/components/admin/KeyExport.tsx - 卡密导出
功能：
- 导出当前筛选结果为 CSV
- CSV 格式：code, status, batchNo, note, createdAt, expiresAt, consumedAt

## API 路由权限验证
所有 /api/admin/* 路由需要：
1. 验证 token/cookie
2. 记录操作日志（谁、何时、做了什么）

## 验收标准
- [ ] 管理员登录正常工作
- [ ] 错误密码返回错误提示
- [ ] 卡密生成、列表、筛选正常
- [ ] 作废卡密后状态正确更新
- [ ] CSV 导出正常
- [ ] 未登录访问 /admin/dashboard 跳转到登录页
