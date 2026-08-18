-- Phase 6: Schema fixes + Token usage records

-- ============================================================
-- 1. 修正: 将 isPublic 和 embedConfig 从 Application 移到 AppShare
-- ============================================================

-- 1a. 创建 app_shares 表（如果不存在）
CREATE TABLE IF NOT EXISTS "app_shares" (
    "id" TEXT NOT NULL,
    "shareLink" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "embedConfig" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "applicationId" TEXT NOT NULL,

    CONSTRAINT "app_shares_pkey" PRIMARY KEY ("id")
);

-- 1b. 迁移 Application 中的分享数据到 AppShare
-- 仅迁移有 shareLink 的应用
INSERT INTO "app_shares" ("id", "shareLink", "isPublic", "embedConfig", "applicationId", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    "shareLink",
    COALESCE("isPublic", true),
    "embedConfig",
    "id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "applications"
WHERE "shareLink" IS NOT NULL
ON CONFLICT DO NOTHING;

-- 1c. 为 AppShare 添加唯一约束
CREATE UNIQUE INDEX IF NOT EXISTS "app_shares_shareLink_key" ON "app_shares"("shareLink");
CREATE UNIQUE INDEX IF NOT EXISTS "app_shares_applicationId_key" ON "app_shares"("applicationId");

-- 1d. 添加外键约束
ALTER TABLE "app_shares" DROP CONSTRAINT IF EXISTS "app_shares_applicationId_fkey";
ALTER TABLE "app_shares" ADD CONSTRAINT "app_shares_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 1e. 从 Application 中移除 isPublic 和 embedConfig（已迁移到 AppShare）
-- 注意: 保留 shareLink 在 Application 上以便快速查找
ALTER TABLE "applications" DROP COLUMN IF EXISTS "isPublic";
ALTER TABLE "applications" DROP COLUMN IF EXISTS "embedConfig";

-- ============================================================
-- 2. 修正: ApiKey 表的 applicationId 外键（Phase 5 migration 中已有字段但需确认外键）
-- ============================================================

-- 确认外键约束存在（上一步 migration 可能已添加）
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'api_keys_applicationId_fkey'
    ) THEN
        ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_applicationId_fkey"
            FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- ============================================================
-- 3. Token 使用量记录表 (Phase 6.2)
-- ============================================================

CREATE TABLE "token_usage_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT,
    "workflowId" TEXT,
    "executionId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "callType" TEXT NOT NULL DEFAULT 'chat',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_usage_records_pkey" PRIMARY KEY ("id")
);

-- 外键约束
ALTER TABLE "token_usage_records" ADD CONSTRAINT "token_usage_records_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "token_usage_records" ADD CONSTRAINT "token_usage_records_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "token_usage_records" ADD CONSTRAINT "token_usage_records_workflowId_fkey"
    FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "token_usage_records" ADD CONSTRAINT "token_usage_records_executionId_fkey"
    FOREIGN KEY ("executionId") REFERENCES "workflow_executions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 索引
CREATE INDEX "token_usage_records_userId_idx" ON "token_usage_records"("userId");
CREATE INDEX "token_usage_records_applicationId_idx" ON "token_usage_records"("applicationId");
CREATE INDEX "token_usage_records_model_idx" ON "token_usage_records"("model");
CREATE INDEX "token_usage_records_provider_idx" ON "token_usage_records"("provider");
CREATE INDEX "token_usage_records_createdAt_idx" ON "token_usage_records"("createdAt");
CREATE INDEX "token_usage_records_userId_createdAt_idx" ON "token_usage_records"("userId", "createdAt");
CREATE INDEX "token_usage_records_applicationId_createdAt_idx" ON "token_usage_records"("applicationId", "createdAt");
