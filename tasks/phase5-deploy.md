# Phase 5: VPS 部署

## 目标
将应用部署到 VPS，通过 Cloudflare 代理访问。

## 部署信息

| 项目 | 值 |
|------|-----|
| 域名 | 91gemini.indevs.in |
| VPS IP | 216.36.104.21 |
| 代理 | Cloudflare (橙色云朵) |
| SSL | Cloudflare Full 模式 |

## 部署步骤

### 1. 本地准备

#### 创建 Dockerfile
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
CMD ["node", "server.js"]
```

#### 创建 docker-compose.yml
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=file:./data/prod.db
      - UPSTREAM_CDK=${UPSTREAM_CDK}
      - ADMIN_PASSWORD=${ADMIN_PASSWORD}
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

#### 更新 next.config.js
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
};

module.exports = nextConfig;
```

#### 本地构建测试
```bash
npm run build
docker build -t sheerid-gemini .
docker run -p 3000:3000 --env-file .env sheerid-gemini
```

### 2. 上传到 VPS

```bash
# 方式一：rsync
rsync -avz --exclude node_modules --exclude .next --exclude .git \
  ./ root@216.36.104.21:/var/www/sheerid_gemini/

# 方式二：Git（推荐）
# 在 VPS 上 git clone 或 git pull
```

### 3. VPS 环境准备

```bash
# 安装 Docker（如未安装）
curl -fsSL https://get.docker.com | sh

# 安装 Docker Compose
sudo apt install docker-compose -y

# 创建数据目录
mkdir -p /var/www/sheerid_gemini/data
```

### 4. 配置环境变量

```bash
cd /var/www/sheerid_gemini
cat > .env << EOF
DATABASE_URL="file:./data/prod.db"
UPSTREAM_CDK="your_real_cdk_here"
ADMIN_PASSWORD="your_secure_password"
EOF
```

### 5. 启动应用

```bash
cd /var/www/sheerid_gemini
docker-compose up -d --build

# 查看日志
docker-compose logs -f
```

### 6. 配置 Nginx

#### 创建 /etc/nginx/sites-available/sheerid
```nginx
server {
    listen 80;
    listen 443 ssl http2;
    server_name 91gemini.indevs.in;

    # Cloudflare Origin Certificate（如使用 Full Strict）
    # ssl_certificate /etc/nginx/ssl/cloudflare-origin.pem;
    # ssl_certificate_key /etc/nginx/ssl/cloudflare-origin.key;

    # 如使用 Full 模式，可用自签名证书
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

#### 启用站点
```bash
ln -s /etc/nginx/sites-available/sheerid /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 7. 生成自签名证书（Full 模式）

```bash
mkdir -p /etc/nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/selfsigned.key \
  -out /etc/nginx/ssl/selfsigned.crt \
  -subj "/CN=91gemini.indevs.in"
```

### 8. Cloudflare 配置

1. 登录 Cloudflare Dashboard
2. 进入 SSL/TLS 设置
3. 选择 **Full** 模式
4. 开启 **Always Use HTTPS**
5. 设置 **Minimum TLS Version** 为 1.2

### 9. 数据库迁移

```bash
docker-compose exec app npx prisma migrate deploy
```

### 10. 验证部署

```bash
# 本地测试
curl -I http://127.0.0.1:3000

# 外部测试
curl -I https://91gemini.indevs.in
```

## 验收标准
- [ ] https://91gemini.indevs.in 正常访问
- [ ] SSL 证书有效（浏览器无警告）
- [ ] 用户验证功能正常
- [ ] 管理员登录正常
- [ ] SSE 实时更新正常
- [ ] Docker 容器自动重启（重启 VPS 后）
