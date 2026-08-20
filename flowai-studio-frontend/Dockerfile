# ============================================================
# Agent Flow Platform Frontend - Multi-stage Docker Build
# ============================================================
# Stage 1: Builder - npm install + Vite build
# Stage 2: Nginx 静态资源服务
#
# 竞品对标:
# - Dify: Nginx 多阶段构建
# - Coze: CDN + Nginx
# - n8n: 不分离前后端
# ============================================================

# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# 先复制依赖文件（利用 Docker 缓存层）
COPY package*.json ./

# 安装依赖
RUN npm ci

# 复制源代码
COPY . .

# 构建生产版本。大型 Ant Design/图表依赖在 Vite 打包阶段可能超过
# Node.js 根据宿主机内存自动计算出的默认堆上限。
RUN NODE_OPTIONS=--max-old-space-size=2048 npm run build

# Stage 2: Nginx
FROM nginx:alpine AS runner

# 复制自定义 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 从 builder 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 暴露端口
EXPOSE 80

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
