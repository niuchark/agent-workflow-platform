-- CreateTable
CREATE TABLE "workflow_traces" (
    "id" TEXT NOT NULL,
    "traceId" TEXT NOT NULL,
    "userId" TEXT,
    "applicationId" TEXT,
    "workflowId" TEXT NOT NULL,
    "executionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'running',
    "totalMs" INTEGER,
    "spanCount" INTEGER NOT NULL DEFAULT 0,
    "inputs" TEXT,
    "outputs" TEXT,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_traces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "span_records" (
    "id" TEXT NOT NULL,
    "spanId" TEXT NOT NULL,
    "traceId" TEXT NOT NULL,
    "parentSpanId" TEXT,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'internal',
    "status" TEXT NOT NULL DEFAULT 'ok',
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "durationMs" INTEGER,
    "attributes" TEXT,
    "events" TEXT,

    CONSTRAINT "span_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workflow_traces_traceId_key" ON "workflow_traces"("traceId");

-- CreateIndex
CREATE INDEX "workflow_traces_traceId_idx" ON "workflow_traces"("traceId");

-- CreateIndex
CREATE INDEX "workflow_traces_workflowId_idx" ON "workflow_traces"("workflowId");

-- CreateIndex
CREATE INDEX "workflow_traces_userId_idx" ON "workflow_traces"("userId");

-- CreateIndex
CREATE INDEX "workflow_traces_createdAt_idx" ON "workflow_traces"("createdAt");

-- CreateIndex
CREATE INDEX "workflow_traces_status_idx" ON "workflow_traces"("status");

-- CreateIndex
CREATE INDEX "span_records_traceId_idx" ON "span_records"("traceId");

-- CreateIndex
CREATE UNIQUE INDEX "span_records_spanId_key" ON "span_records"("spanId");

-- CreateIndex
CREATE INDEX "span_records_spanId_idx" ON "span_records"("spanId");

-- CreateIndex
CREATE INDEX "span_records_parentSpanId_idx" ON "span_records"("parentSpanId");

-- CreateIndex
CREATE INDEX "span_records_startTime_idx" ON "span_records"("startTime");

-- AddForeignKey
ALTER TABLE "workflow_traces" ADD CONSTRAINT "workflow_traces_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "span_records" ADD CONSTRAINT "span_records_traceId_fkey" FOREIGN KEY ("traceId") REFERENCES "workflow_traces"("traceId") ON DELETE CASCADE ON UPDATE CASCADE;
