# Agent Flow Platform

Agent Flow Platform 是一个先进的全栈可视化 AI 应用低代码编排平台。

## 技术栈

### 前端 (Frontend)

- 核心框架: React 18 (Vite)
- 状态管理: Zustand
- UI 组件库: Ant Design (AntD)
- 流程图引擎: React Flow (@xyflow/react)
- 样式处理: Taliwind CSS + Ant Design Token
- 路由管理: React Router v6

### 后端 (Backend)

- 核心框架: NestJS
- 数据库层: Prisma ORM + SQLite
- 认证安全: JWT (JSON Web Token)
- 校验工具: class-validator + class-transformer
- 异步通信: Axios / Server-Sent Events (SSE)
- 代码沙箱: vm2

## 快速开始

### 1. 环境准备

确保您的开发环境已安装以下软件：

- Node.js (v18.0.0 或更高版本)
- npm (v9.0.0 或更高版本)

### 2. 后端配置与启动

```bash
cd flowai-studio-backend
# 安装项目依赖
npm install
# 配置环境变量 (参考 .env.example)
cp .env.example .env
# 同步数据库结构
npx prisma db push
# 写入默认演示数据（默认账号、默认知识库、默认文档）
npx prisma db seed
# 启动后端开发服务器
npm run start:dev
```

启动后请登录系统，在侧栏「模型服务」中为当前用户配置并测试 Qwen、OpenAI-compatible 或 Ollama。

生产环境必须设置 `MODEL_CREDENTIAL_ENCRYPTION_KEY`。可使用 `openssl rand -base64 32` 生成，并将其与数据库备份一同安全保管；密钥丢失后，数据库中已加密的用户模型 Key 无法恢复。私网 Ollama 等地址需由管理员通过 `MODEL_PRIVATE_BASE_URL_ALLOWLIST` 配置精确 Origin 白名单。

生产发布使用 `npx prisma migrate deploy`；Docker 镜像启动时也会自动执行该命令。若旧数据库曾使用 `prisma db push` 创建，可能出现 Prisma `P3005`。此时应先备份并在数据库副本上核对结构，再用 `prisma migrate resolve --applied <旧迁移名>` 为已有的历史迁移建立基线；不要把 `20260819000000_add_model_credentials` 标为已执行，最后再运行 `migrate deploy` 创建用户凭证表。

### 3. 前端配置与启动

```bash
cd flowai-studio-frontend
# 安装项目依赖
npm install
# 启动前端开发服务器
npm run dev
```

启动完成后，在浏览器中访问 <http://localhost:5173> 即可开始您的 AI 编排之旅。

## 默认账号（演示用）

- 用户名：admin
- 密码：admin123

## 如何验证 RAG（最短路径）

1. 使用默认账号登录。
2. 打开「知识库管理」，确认存在「默认知识库」，并且里面有文档「Agent Flow Platform 功能介绍.md」。
3. 打开「调试中心」→「AI 聊天」，在"关联知识库"下拉框中选择「默认知识库」。
4. 发送问题：`Agent Flow Platform 有什么核心特性？`
5. 观察返回结果下方的「参考文档」区域，应该能看到命中的文档片段与相似度。

## 验证 RAG（接口方式，可选）

```bash
# 1) 登录获取 token
curl -s -X POST http://localhost:3000/api/users/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}'

# 2) 带 token 获取知识库列表（将 YOUR_TOKEN 替换成上一步返回的 token）
curl -s http://localhost:3000/api/rag/knowledge-bases \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3) 检索（将 KB_ID 替换成知识库 id）
curl -s -X POST http://localhost:3000/api/rag/retrieve \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"query":"Agent Flow Platform 有什么核心特性","knowledgeBaseId":"KB_ID","topK":3}'
```

## 项目结构说明

```text
├── flowai-studio-frontend   # 前端工程
│   ├── src/components       # 通用组件及工作流节点组件
│   ├── src/pages            # 业务页面视图
│   ├── src/store            # 全局状态管理切片
│   ├── src/router           # 路由导航配置
│   └── src/types            # TypeScript 类型定义
└── flowai-studio-backend    # 后端工程
    ├── src/modules          # 业务逻辑模块 (AI, App, Workflow, RAG, Skill, MCP, User)
    ├── src/common           # 公共中间件、装饰器、拦截器
    ├── src/config           # 环境变量与全局配置
    └── prisma               # 数据库 Schema 定义与 Seed 脚本
```

