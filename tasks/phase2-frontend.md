# Phase 2: 用户前端

## 目标
实现用户验证界面，包括表单、进度展示、帮助弹窗。

## 设计要求
- 现代暗色主题
- 响应式布局
- 微动画增强体验
- SSE 实时更新

## 文件清单

### 1. src/app/globals.css - 全局样式
设计要求：
- 暗色背景 (#0a0a0a 或类似)
- 渐变点缀色 (蓝紫色系)
- 圆角卡片设计
- 微动画 (hover, loading)

### 2. src/app/layout.tsx - 根布局
```typescript
import './globals.css';

export const metadata = {
  title: 'Gemini 学生认证平台',
  description: '使用卡密激活 SheerID 学生验证',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
```

### 3. src/app/page.tsx - 主页面
页面结构：
- Header: 标题 + 帮助按钮
- StatsWidget: 今日统计
- VerificationForm: 验证表单
- VerificationProgress: 验证进度（提交后显示）
- HelpModal: 帮助弹窗

### 4. src/components/VerificationForm.tsx - 验证表单
功能：
- 模式切换：单条 / 批量
- SheerID 链接输入 (textarea，支持多行)
- 卡密输入 (textarea，支持多行)
- 数量匹配校验 (链接数 === 卡密数)
- 前端即时验证 verificationId 格式
- 粘贴时自动处理换行分隔
- 提交按钮 (disabled 状态管理)

校验规则：
- verificationId 必须 24 位十六进制
- 前缀必须为 69 或 6a
- 校验失败即时显示错误提示

### 5. src/components/VerificationProgress.tsx - 进度展示
功能：
- 接收 SSE 事件流
- 每条链接独立状态卡片
- 状态图标：⏳ Processing, 🔄 Pending, ✅ Success, ❌ Fail
- 成功时显示 resultUrl（可复制）
- 卡密消耗状态指示
- 进度条（总数/完成数）

### 6. src/components/StatsWidget.tsx - 今日统计
功能：
- 调用 GET /api/stats
- 展示: 今日成功 / 今日失败 / 总计
- 自动刷新（每 30 秒 或验证完成后）

### 7. src/components/HelpModal.tsx - 帮助弹窗
内容：
- ⚠️ **关键提示**：必须右键复制链接，不要点击进入后再复制
- 操作步骤图示
- 常见错误及解决方案表格
- SheerID 链接格式示例
- 卡密使用规则说明

## 验收标准
- [ ] 页面在 http://localhost:3000 正常显示
- [ ] 表单验证正确（无效 ID 提示错误）
- [ ] SSE 进度实时更新
- [ ] 帮助弹窗正常显示/隐藏
- [ ] 移动端布局正常
