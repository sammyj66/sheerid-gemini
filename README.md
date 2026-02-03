# Gemini 学生认证平台

Gemini 学生认证平台，用卡密激活 SheerID 学生验证，前台支持实时进度（SSE），管理端支持卡密生成、管理与审计。

> 说明：由于当前上游接口偶发返回 **502**，部分真实验证流程无法在本地完整回归测试。代码已按规范完成并增强了上游 CSRF 获取逻辑，需在上游可用环境验证。

## 已实现功能
- 前台验证：一卡一链 / 一卡多链
- SSE 实时进度展示（含结果链接）
- 卡密剩余次数查询与展示
- 验证成功扣费、失败/超时不扣费
- 管理端登录认证（Cookie 会话）
- 卡密 CRUD、批量导出、批量作废/删除
- 审计日志查看与清空
- Prisma + SQLite 数据库
- Docker 部署与 standalone 输出

## 项目结构
- `src/app`：页面与 API 路由
- `src/components`：前端组件
- `src/lib`：业务逻辑与上游请求
- `prisma`：数据模型与迁移

## 本地开发
```bash
npm install
npm run dev
```

## 生产部署（Docker）
```bash
docker-compose up -d --build
```

## 生产部署（PM2）
```bash
npm ci
npx prisma generate
npm run build

# 生产数据库迁移（首次部署执行）
npx prisma migrate deploy

# 启动
pm2 start npm --name sheerid-gemini -- start
```

## 环境变量
请在 `.env` 中配置以下变量（示例，不含真实密钥）：

```bash
DATABASE_URL="file:./dev.db"
UPSTREAM_CDK="your_cdk_here"
UPSTREAM_BASE="https://neigui.1key.me"
ADMIN_PASSWORD="your_admin_password"
TZ="Asia/Shanghai"
```

## 使用说明
### 前台验证
1. 获取 SheerID 验证链接（右键复制链接地址）。
2. 选择模式：
   - 一卡一链：链接数量 = 卡密数量
   - 一卡多链：1 个卡密 + 多条链接（不超过剩余次数）
3. 点击“开始验证”，在“验证进度”查看实时状态与结果链接。

### 管理端
1. 访问 `/admin/login`
2. 输入 `ADMIN_PASSWORD` 登录
3. 生成卡密、批量操作、导出、查看审计日志

## API 使用说明
> 以下为主要接口概要，详情请结合源码与 `api .json` 参考。

### 1) 验证接口（SSE）
`POST /api/verify`

请求体：
```json
{
  "links": ["https://services.sheerid.com/verify/..."],
  "cardKeys": ["YOUR_CARD_KEY"]
}
```

返回：`text/event-stream`  
事件类型：`queued` / `result` / `error` / `duplicate`

### 2) 查询卡密/验证状态
`POST /api/query`

请求体：
```json
{
  "cardKey": "YOUR_CARD_KEY"
}
```

返回示例：
```json
{
  "found": true,
  "status": "UNUSED",
  "maxUses": 3,
  "usedCount": 1,
  "remainingUses": 2
}
```

### 3) 管理端接口（需登录 Cookie）
- `POST /api/admin/login`
- `GET /api/admin/cardkeys`
- `POST /api/admin/cardkeys`
- `PATCH /api/admin/cardkeys/[code]`
- `DELETE /api/admin/cardkeys/[code]`
- `GET /api/admin/logs`
- `DELETE /api/admin/logs`

## 已知限制
- 上游 `neigui.1key.me` 在部分环境返回 502，导致 CSRF Token 无法获取，真实验证流程需在上游可用环境验证。

