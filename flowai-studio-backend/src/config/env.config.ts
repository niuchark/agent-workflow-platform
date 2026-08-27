/**
 * 环境变量配置：用 Zod 定义并校验所有必需的 env 变量。
 *
 * 应用启动时通过 ConfigModule.forRoot 调用本 schema 校验，
 * 缺少必填项（如 JWT_SECRET、DATABASE_URL）会直接启动失败；
 * 生产环境额外强制要求模型凭证加密密钥。
 */
import { z } from 'zod';

/** 环境变量 schema：全部配置项及其默认值、校验规则 */
export const envSchema = z.object({
  // 服务器配置
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),

  // JWT配置
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // 通义千问API配置
  QWEN_API_KEY: z.string().optional(),
  QWEN_BASE_URL: z.string().default('https://dashscope.aliyuncs.com/compatible-mode/v1'),

  // 通义千问向量模型配置
  QWEN_EMBEDDING_API_KEY: z.string().optional(),
  QWEN_EMBEDDING_MODEL: z.string().default('text-embedding-v3'),
  QWEN_EMBEDDING_DIMENSION: z.coerce.number().default(1024),

  // OpenAI Embedding 配置
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().default('https://api.openai.com/v1'),
  OPENAI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  OPENAI_EMBEDDING_DIMENSION: z.coerce.number().default(1536),

  // Ollama 本地模型配置
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
  OLLAMA_EMBEDDING_MODEL: z.string().default('nomic-embed-text'),
  OLLAMA_EMBEDDING_DIMENSION: z.coerce.number().default(768),

  // 默认 Embedding Provider (qwen | openai | ollama)
  EMBEDDING_PROVIDER: z.string().default('qwen'),

  // 默认 Vector Store (pgvector | qdrant | milvus)
  VECTOR_STORE: z.string().default('pgvector'),

  // Qdrant 配置
  QDRANT_URL: z.string().default('http://localhost:6333'),
  QDRANT_API_KEY: z.string().optional(),

  // Milvus 配置
  MILVUS_URL: z.string().default('http://localhost:19530'),
  MILVUS_TOKEN: z.string().optional(),

  // Cohere Rerank 配置
  COHERE_API_KEY: z.string().optional(),
  COHERE_BASE_URL: z.string().default('https://api.cohere.com'),
  COHERE_RERANK_MODEL: z.string().default('rerank-v3.5'),

  // Ollama Rerank 配置
  OLLAMA_RERANK_MODEL: z.string().default('bge-reranker-v2-m3'),

  // 数据库配置 — PostgreSQL + pgvector
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Redis 配置
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // 用户模型凭证加密与私网 Base URL 白名单
  MODEL_CREDENTIAL_ENCRYPTION_KEY: z.string().optional(),
  MODEL_PRIVATE_BASE_URL_ALLOWLIST: z.string().default(''),

  // 其他出站 HTTP（自定义/内置 Skill）允许访问的私网 Origin 白名单
  OUTBOUND_PRIVATE_URL_ALLOWLIST: z.string().default(''),

  // stdio MCP 会启动本机子进程，默认关闭；启用后仍必须配置精确命令白名单
  MCP_STDIO_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  MCP_STDIO_COMMAND_ALLOWLIST: z.string().default(''),
}).superRefine((config, ctx) => {
  // 生产环境必须配置模型凭证加密密钥，否则拒绝启动
  if (config.NODE_ENV === 'production' && !config.MODEL_CREDENTIAL_ENCRYPTION_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['MODEL_CREDENTIAL_ENCRYPTION_KEY'],
      message: 'MODEL_CREDENTIAL_ENCRYPTION_KEY is required in production',
    });
  }
  if (config.NODE_ENV === 'production') {
    const secret = config.JWT_SECRET.trim();
    if (secret.length < 32 || ['change-me-in-production', 'your-secret-key-change-me'].includes(secret)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET must be at least 32 characters and non-default in production',
      });
    }
  }
});

/** 校验后的环境变量类型（与 envSchema 推断一致） */
export type EnvConfig = z.infer<typeof envSchema>;
