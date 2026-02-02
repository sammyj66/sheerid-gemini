# SheerID Gemini 验证平台 - 分步任务指南

本目录包含项目各阶段的详细实施任务，每个文件可独立交给 Codex 或其他 AI 编程助手执行。

## 任务文件

| 文件 | 阶段 | 预计时间 | 说明 |
|------|------|---------|------|
| [phase0-init.md](./phase0-init.md) | Phase 0 | 10 分钟 | 项目初始化、Prisma 配置 |
| [phase1-backend.md](./phase1-backend.md) | Phase 1 | 40 分钟 | 后端核心模块、API 对接 |
| [phase2-frontend.md](./phase2-frontend.md) | Phase 2 | 30 分钟 | 用户前端界面 |
| [phase3-admin.md](./phase3-admin.md) | Phase 3 | 30 分钟 | 管理员模块 |
| [phase4-testing.md](./phase4-testing.md) | Phase 4 | 20 分钟 | 测试与优化 |
| [phase5-deploy.md](./phase5-deploy.md) | Phase 5 | 20 分钟 | VPS 部署 |

## 执行顺序

```
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
```

⚠️ **必须按顺序执行**，每个阶段依赖前一阶段的产出。

## 使用方法

### 方法一：单阶段执行
```
给 Codex 发送：
"请阅读 tasks/phase0-init.md 并执行其中的步骤"
```

### 方法二：逐步执行
```
给 Codex 发送：
"请执行 Phase 0 的第 1 步：创建 Next.js 项目"
```

## 验收检查

每个阶段末尾都有验收标准清单，完成后请逐项确认。

## 核心配置

### 环境变量
```env
DATABASE_URL="file:./dev.db"
UPSTREAM_CDK="your_cdk_here"
ADMIN_PASSWORD="your_secure_password"
```

### 部署目标
- 域名: `91gemini.indevs.in`
- VPS IP: `216.36.104.21`
- Cloudflare: 橙色云朵 (Proxied)
