# Gemini 学生认证平台

Gemini 学生认证平台 - 使用卡密激活 SheerID 学生验证。

## 功能特性
- 单条 / 批量验证
- 实时进度显示（SSE）
- 管理后台与审计日志
- 卡密生成、搜索、撤销与导出

## 技术栈
- Next.js（当前版本 16.1.6）
- TypeScript
- Prisma + SQLite
- CSS：原生 CSS（无 Tailwind 依赖，可按需接入 TailwindCSS）

## 使用教程（用户端）
1. 获取 SheerID 验证链接。
2. 粘贴链接与卡密，选择“单条 / 批量”。
3. 提交验证后在“验证进度”中查看实时状态与结果链接。

## 使用教程（管理端）
1. 访问 `/admin/login` 使用管理员密码登录。
2. 在后台生成卡密、查看状态、导出记录与审计日志。

## 本地开发
```bash
npm install
npm run dev
```

## Docker 部署（本地）
```bash
docker-compose up -d --build
```

## VPS 部署（Docker + Nginx + Cloudflare）
> 以下为通用流程，请使用你自己的域名与服务器地址。

### 1) 上传代码到 VPS
方式一（推荐）：在 VPS 上 `git clone` / `git pull`

方式二（rsync）：
```bash
rsync -avz --exclude node_modules --exclude .next --exclude .git \
  ./ root@YOUR_VPS_IP:/var/www/your_project/
```

### 2) VPS 环境准备
```bash
# 安装 Docker
curl -fsSL https://get.docker.com | sh

# 安装 docker-compose
sudo apt install docker-compose -y

# 创建数据目录
mkdir -p /var/www/your_project/data
```

### 3) 配置环境变量
```bash
cd /var/www/your_project
cat > .env << EOF
DATABASE_URL="file:./data/prod.db"
UPSTREAM_CDK="your_cdk_here"
ADMIN_PASSWORD="your_admin_password_here"
EOF
```

### 4) 启动应用（对应 tasks 的“步骤 5”）
```bash
cd /var/www/your_project
docker-compose up -d --build

# 查看日志
docker-compose logs -f
```

### 5) 配置 Nginx 反代（支持 SSE）
```nginx
server {
    listen 80;
    listen 443 ssl http2;
    server_name your-domain.example.com;

    # 如使用 Cloudflare Full 模式可使用自签名证书
    ssl_certificate /etc/nginx/ssl/selfsigned.crt;
    ssl_certificate_key /etc/nginx/ssl/selfsigned.key;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # SSE 支持
        proxy_buffering off;
        proxy_read_timeout 86400;
    }
}
```

启用站点：
```bash
ln -s /etc/nginx/sites-available/your_project /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 6) 证书与 Cloudflare
- Cloudflare SSL/TLS 设置选择 **Full**（或 Full Strict）。
- 开启 Always Use HTTPS。

### 7) 数据库迁移
```bash
docker-compose exec app npx prisma migrate deploy
```

## 环境变量
请在 `.env` 中配置以下变量（使用占位符示例，不要填写真实密钥）：

```bash
DATABASE_URL="file:./dev.db"
UPSTREAM_CDK="your_cdk_here"
ADMIN_PASSWORD="your_admin_password_here"
```
