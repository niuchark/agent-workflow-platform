CREATE TABLE "model_credentials" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "encryptedApiKey" TEXT,
    "encryptionIv" TEXT,
    "encryptionTag" TEXT,
    "keyPrefix" TEXT,
    "keySuffix" TEXT,
    "status" TEXT NOT NULL DEFAULT 'untested',
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastTestedAt" TIMESTAMP(3),
    "lastTestMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "model_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "model_credentials_userId_provider_key"
ON "model_credentials"("userId", "provider");

CREATE INDEX "model_credentials_userId_idx"
ON "model_credentials"("userId");

ALTER TABLE "model_credentials"
ADD CONSTRAINT "model_credentials_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
