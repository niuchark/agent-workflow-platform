# Agent Flow Platform

Agent Flow Platform 是一个全栈可视化 AI 应用低代码编排平台。

## 技术栈

### 前端

- React 18 + Vite
- Zustand
- Ant Design
- React Flow (`@xyflow/react`)
- Tailwind CSS + Ant Design Token
- React Router v7

### 后端

- NestJS
- Prisma ORM + PostgreSQL 16 + pgvector
- Redis
- JWT、class-validator、class-transformer
- Server-Sent Events (SSE)

## 本地开发

### 环境要求

- Node.js 20 或更高版本
- npm 10 或更高版本
- PostgreSQL 16，并启用 pgvector 扩展
- Redis 7

### 1. 安装依赖与 Git hooks

```bash
npm ci
npm --prefix flowai-studio-backend ci
npm --prefix flowai-studio-frontend ci
npm run setup:hooks
```

### 2. 配置并启动后端

```bash
cd flowai-studio-backend
cp .env.example .env
# 按本机 PostgreSQL、Redis 和安全要求编辑 .env
npm run db:generate
npm run db:migrate:deploy
# 仅在需要演示账号和演示数据时运行
npx prisma db seed
npm run start:dev
```

已有迁移必须通过 `prisma migrate` 管理。请勿使用 `prisma db push` 代替迁移，也不要在生产数据库运行 seed。

启动后请登录系统，在侧栏「模型服务」中为当前用户配置并测试 Qwen、OpenAI-compatible 或 Ollama。

### 3. 启动前端

```bash
cd flowai-studio-frontend
npm run dev
```

浏览器访问 <http://localhost:5173>。Vite 会把 `/api` 代理到本机 `3000` 端口的后端。

## Docker Compose 部署

仓库根目录的 Compose 文件会启动 PostgreSQL、Redis、后端和前端 Nginx。

```bash
cp .env.example .env

# 编辑 .env，填写三个必需密钥并确认公开地址后验证配置
docker compose config --quiet
docker compose up -d --build
```

默认仅监听 `127.0.0.1:8080`。在部署主机访问 <http://localhost:8080>；对外发布时应在其前方配置 HTTPS 反向代理，并把 `FRONTEND_URL` 设置为无尾部斜杠的公开 Origin。

生产部署必须配置：

- `POSTGRES_PASSWORD`：建议使用 `openssl rand -hex 24` 生成 URL-safe 密码。
- `JWT_SECRET`：建议使用 `openssl rand -hex 32` 生成。
- `MODEL_CREDENTIAL_ENCRYPTION_KEY`：使用 `openssl rand -base64 32` 生成，并与数据库备份一同安全保管。密钥丢失后，已加密的用户模型 Key 无法恢复。
- `MODEL_PRIVATE_BASE_URL_ALLOWLIST`：私网模型服务的精确 Origin 白名单。

后端容器启动时会自动运行 `prisma migrate deploy`。发布前应先备份数据库并在数据库副本验证迁移；生产环境不要运行 `prisma migrate dev`、`prisma db push` 或 seed。

## 演示账号

只有执行 `npx prisma db seed` 后才会创建演示账号：

- 用户名：`admin`
- 密码：`admin123`

Seed 会把 `admin` 密码重置为上述公开密码，仅限本地演示环境使用。

## 验证 RAG

1. 使用演示账号登录。
2. 在「模型服务」配置并启用可用的模型凭证。
3. 打开「知识库管理」，确认存在「默认知识库」和文档「Agent Flow Platform 功能介绍.md」。
4. 打开「调试中心」→「AI 聊天」，选择「默认知识库」。
5. 发送问题：`Agent Flow Platform 有什么核心特性？`

接口验证示例（本地开发后端）：

```bash
curl -s -X POST http://localhost:3000/api/users/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}'

curl -s http://localhost:3000/api/rag/knowledge-bases \
  -H "Authorization: Bearer YOUR_TOKEN"

curl -s -X POST http://localhost:3000/api/rag/retrieve \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"query":"Agent Flow Platform 有什么核心特性","knowledgeBaseId":"KB_ID","topK":3}'
```

## 工程质量检查

从仓库根目录运行：

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run compose:validate
npm run verify
```

`verify` 会依次执行前后端类型检查、告警数门禁、后端单元/HTTP API 测试、前后端构建和 Compose 配置校验。

## 项目结构

```text
├── .github/workflows          # CI/CD 工作流
├── scripts                    # 数据库初始化等工程脚本
├── docker-compose.yml         # 本地容器编排与部署基线
├── flowai-studio-frontend     # React/Vite 前端
│   └── src
│       ├── components
│       ├── pages
│       ├── router
│       ├── store
│       ├── types
│       └── utils
└── flowai-studio-backend      # NestJS 后端
    ├── prisma                 # Prisma schema、迁移与 seed
    └── src
        ├── common
        ├── config
        └── modules
```
