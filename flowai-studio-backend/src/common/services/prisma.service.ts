/**
 * Prisma 数据库服务：封装 PrismaClient 生命周期与向量检索能力。
 *
 * - 启动时连接数据库并自动启用 pgvector 扩展；
 * - 提供基于 pgvector 的向量分块插入方法
 *   （Prisma 原生不支持 vector 类型，故使用 raw SQL）。
 */
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

/** Prisma 服务：连接管理 + pgvector 向量操作 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  /** 模块初始化：连接数据库并启用 pgvector 扩展 */
  async onModuleInit() {
    await this.$connect();
    await this.enablePgvectorExtension();
  }

  /** 模块销毁：断开数据库连接 */
  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * 启用 pgvector 扩展
   * pgvector 是 PostgreSQL 的向量相似度搜索扩展
   * 竞品对标: Dify 支持 pgvector 作为默认向量存储后端
   */
  /** 启用 pgvector 扩展（失败仅告警，不影响主流程） */
  private async enablePgvectorExtension() {
    try {
      await this.$executeRaw(Prisma.sql`CREATE EXTENSION IF NOT EXISTS vector`);
      this.logger.log('pgvector extension enabled successfully');
    } catch (error) {
      this.logger.warn(
        `Failed to enable pgvector extension: ${error instanceof Error ? error.message : error}. ` +
          `Vector search will not be available. Please ensure pgvector is installed in your PostgreSQL instance.`,
      );
    }
  }

  /**
   * 插入带有向量数据的记录
   * 使用 Prisma 的 raw query 来处理 Unsupported("vector") 类型字段
   */
  async insertVectorChunk(params: {
    documentId: string;
    content: string;
    embedding: number[];
    chunkIndex: number;
    startIndex: number;
    endIndex: number;
    metadata?: string;
  }): Promise<void> {
    const { documentId, content, embedding, chunkIndex, startIndex, endIndex, metadata } = params;
    const vectorStr = `[${embedding.join(',')}]`;

    await this.$executeRaw(Prisma.sql`
      INSERT INTO document_chunks ("id", "content", "embedding", "chunkIndex", "startIndex", "endIndex", "metadata", "documentId", "createdAt")
      VALUES (
        gen_random_uuid(),
        ${content},
        CAST(${vectorStr} AS vector),
        ${chunkIndex},
        ${startIndex},
        ${endIndex},
        CAST(${metadata ?? null} AS jsonb),
        ${documentId},
        NOW()
      )
    `);
  }

  /**
   * 批量插入带有向量数据的记录
   * 比单条插入性能更优，适合文档分块后的批量写入
   */
  async batchInsertVectorChunks(params: {
    documentId: string;
    chunks: {
      content: string;
      embedding: number[];
      chunkIndex: number;
      startIndex: number;
      endIndex: number;
      metadata?: string;
    }[];
  }): Promise<void> {
    const { documentId, chunks } = params;

    if (chunks.length === 0) return;

    const values = chunks.map((chunk) => {
      const vectorStr = `[${chunk.embedding.join(',')}]`;

      return Prisma.sql`(
        gen_random_uuid(),
        ${chunk.content},
        CAST(${vectorStr} AS vector),
        ${chunk.chunkIndex},
        ${chunk.startIndex},
        ${chunk.endIndex},
        CAST(${chunk.metadata ?? null} AS jsonb),
        ${documentId},
        NOW()
      )`;
    });

    await this.$executeRaw(Prisma.sql`
      INSERT INTO document_chunks ("id", "content", "embedding", "chunkIndex", "startIndex", "endIndex", "metadata", "documentId", "createdAt")
      VALUES ${Prisma.join(values)}
    `);
  }
}
