-- Phase 5.1: RBAC 权限模型 — 团队、成员、API 密钥
-- Phase 5.2: 应用发布分享 — 公开链接、嵌入配置

-- 1. User 表添加 globalRole 字段
ALTER TABLE "users" ADD COLUMN "globalRole" TEXT NOT NULL DEFAULT 'member';

-- 2. 创建 teams 表
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "avatar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- 3. 创建 team_members 表
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- 4. 创建 team_applications 关联表
CREATE TABLE "team_applications" (
    "id" TEXT NOT NULL,
    "permission" TEXT NOT NULL DEFAULT 'can_view',
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "teamId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,

    CONSTRAINT "team_applications_pkey" PRIMARY KEY ("id")
);

-- 5. 创建 api_keys 表
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "scopes" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- 6. Application 表添加 isPublic 和 embedConfig 字段
ALTER TABLE "applications" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "applications" ADD COLUMN "embedConfig" TEXT;

-- 7. 外键约束
ALTER TABLE "teams" ADD CONSTRAINT "teams_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "team_members" ADD CONSTRAINT "team_members_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "team_members" ADD CONSTRAINT "team_members_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "team_applications" ADD CONSTRAINT "team_applications_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "team_applications" ADD CONSTRAINT "team_applications_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 8. 唯一约束
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_teamId_userId_key" UNIQUE ("teamId", "userId");
ALTER TABLE "team_applications" ADD CONSTRAINT "team_applications_teamId_applicationId_key" UNIQUE ("teamId", "applicationId");
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_keyHash_key" UNIQUE ("keyHash");

-- 9. 索引
CREATE INDEX "team_members_userId_idx" ON "team_members"("userId");
CREATE INDEX "team_applications_applicationId_idx" ON "team_applications"("applicationId");
CREATE INDEX "api_keys_keyHash_idx" ON "api_keys"("keyHash");
CREATE INDEX "api_keys_userId_idx" ON "api_keys"("userId");
CREATE INDEX "api_keys_applicationId_idx" ON "api_keys"("applicationId");
