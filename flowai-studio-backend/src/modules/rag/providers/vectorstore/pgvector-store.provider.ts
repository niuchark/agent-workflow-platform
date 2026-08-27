/**
 * PgVector Store Provider
 *
 * 基于 PostgreSQL + pgvector 扩展的向量存储实现
 * 使用原始 SQL 操作，因为 Prisma 不原生支持 vector 类型
 *
 * 特性:
 * - HNSW 索引加速近似最近邻搜索
 * - 余弦距离搜索 (<=> 操作符)
 * - 批量 upsert，减少网络往返
 * - 元数据过滤（通过 SQL WHERE 条件）
 * - 自动创建 HNSW 索引
 *
 * 竞品对标:
 * - Dify: pgvector 作为默认向量存储后端 ✓
 * - FastGPT: 使用 MongoDB Atlas Vector
 * - n8n: 无内置向量存储
 *
 * 优势:
 * - 无需额外部署向量数据库（PostgreSQL 即可）
 * - ACID 事务保证数据一致性
 * - HNSW 索引搜索性能优秀
 */
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/services/prisma.service';
import {
  VectorStore,
  VectorDocument,
  VectorSearchQuery,
  VectorSearchResult,
  VectorSearchFilter,
  VectorStoreStats,
} from '../../interfaces/vector-store.interface';

@Injectable()
export class PgVectorStore implements VectorStore {
  private readonly logger = new Logger(PgVectorStore.name);

  readonly storeType = 'pgvector';

  constructor(private prisma: PrismaService) {}

  /**
   * 初始化 pgvector 存储
   * 确保 pgvector 扩展已启用，并为目标表创建 HNSW 索引
   */
  async initialize(collectionName: string, _dimension: number): Promise<void> {
    // pgvector 扩展已在 PrismaService.onModuleInit 中启用
    // 为 document_chunks 表创建 HNSW 索引（如果不存在）
    try {
      await this.prisma.$executeRaw(Prisma.sql`
        CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_hnsw
        ON document_chunks
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
      `);
      this.logger.log(`HNSW index ensured for collection: ${collectionName}`);
    } catch (error) {
      // 索引创建可能因为数据量不足而失败，不影响功能
      this.logger.warn(`HNSW index creation skipped: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * 批量 upsert 向量文档
   * pgvector 不支持原生 UPSERT，使用 INSERT ON CONFLICT DO UPDATE
   */
  async upsert(collectionName: string, documents: VectorDocument[]): Promise<void> {
    if (documents.length === 0) return;

    // 使用批量 INSERT（pgvector 不支持 ON CONFLICT with vector type）
    // 先删除已存在的记录，再插入新记录
    const existingIds = documents.filter((d) => d.id).map((d) => d.id);
    if (existingIds.length > 0) {
      await this.prisma.$executeRaw(Prisma.sql`
        DELETE FROM document_chunks
        WHERE id IN (${Prisma.join(existingIds)})
      `);
    }

    // 批量插入
    const values = documents.map((doc) => {
      const vectorStr = `[${doc.embedding.join(',')}]`;

      return Prisma.sql`(
        ${doc.id},
        ${doc.content},
        CAST(${vectorStr} AS vector),
        CAST(${doc.metadata ? JSON.stringify(doc.metadata) : null} AS jsonb),
        NOW()
      )`;
    });

    // 分批插入，每批最多 100 条（避免 SQL 过长）
    const batchSize = 100;
    for (let i = 0; i < values.length; i += batchSize) {
      const batch = values.slice(i, i + batchSize);
      await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO document_chunks ("id", "content", "embedding", "metadata", "createdAt")
        VALUES ${Prisma.join(batch)}
      `);
    }

    this.logger.log(`Upserted ${documents.length} vectors to ${collectionName}`);
  }

  /**
   * 向量相似度搜索
   * 使用 pgvector 的 <=> 操作符计算余弦距离
   */
  async search(_collectionName: string, query: VectorSearchQuery): Promise<VectorSearchResult[]> {
    const { queryVector, topK = 5, similarityThreshold = 0, filter } = query;

    const vectorStr = `[${queryVector.join(',')}]`;
    const queryVectorSql = Prisma.sql`CAST(${vectorStr} AS vector)`;

    // 构建 WHERE 条件
    const conditions: Prisma.Sql[] = [Prisma.sql`embedding IS NOT NULL`];

    // 相似度阈值过滤
    if (similarityThreshold > 0) {
      conditions.push(Prisma.sql`1 - (embedding <=> ${queryVectorSql}) >= ${similarityThreshold}`);
    }

    // 元数据过滤
    if (filter) {
      const filterClause = this.buildFilterClause(filter);
      if (filterClause) {
        conditions.push(filterClause);
      }
    }

    try {
      const rows = await this.prisma.$queryRaw<
        Array<{
          id: string;
          content: string;
          similarity: number | string;
          metadata?: Record<string, any> | string | null;
        }>
      >(Prisma.sql`
        SELECT
          id,
          content,
          metadata,
          1 - (embedding <=> ${queryVectorSql}) AS similarity
        FROM document_chunks
        WHERE ${Prisma.join(conditions, ' AND ')}
        ORDER BY embedding <=> ${queryVectorSql}
        LIMIT ${topK}
      `);

      return rows.map((row) => ({
        id: row.id,
        content: row.content,
        similarity: Number(Number(row.similarity).toFixed(4)),
        metadata: row.metadata
          ? typeof row.metadata === 'string'
            ? JSON.parse(row.metadata)
            : row.metadata
          : undefined,
      }));
    } catch (error) {
      this.logger.error(`Vector search failed: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }

  /**
   * 按 ID 删除文档
   */
  async delete(_collectionName: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    await this.prisma.$executeRaw(Prisma.sql`
      DELETE FROM document_chunks
      WHERE id IN (${Prisma.join(ids)})
    `);
  }

  /**
   * 按 filter 条件删除文档
   */
  async deleteByFilter(_collectionName: string, filter: VectorSearchFilter): Promise<void> {
    const filterClause = this.buildFilterClause(filter);
    if (!filterClause) {
      this.logger.warn('Empty filter clause, skipping delete');
      return;
    }

    await this.prisma.$executeRaw(Prisma.sql`
      DELETE FROM document_chunks
      WHERE ${filterClause}
    `);
  }

  /**
   * 获取存储统计信息
   */
  async getStats(_collectionName: string): Promise<VectorStoreStats> {
    try {
      const countResults = await this.prisma.$queryRaw<Array<{ total: bigint | number }>>(
        Prisma.sql`SELECT COUNT(*) AS total FROM document_chunks`,
      );
      const countResult = countResults[0];

      return {
        totalDocuments: Number(countResult.total),
        totalVectors: Number(countResult.total),
        indexStatus: 'ready',
      };
    } catch {
      return {
        totalDocuments: 0,
        totalVectors: 0,
        indexStatus: 'error',
      };
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw(Prisma.sql`SELECT 1`);
      return true;
    } catch {
      return false;
    }
  }

  // ============================================================
  // 私有方法
  // ============================================================

  /**
   * 将 VectorSearchFilter 转换为 SQL WHERE 子句
   */
  private buildFilterClause(filter: VectorSearchFilter): Prisma.Sql | null {
    const parts: Prisma.Sql[] = [];

    if (filter.and && filter.and.length > 0) {
      const subClauses = filter.and
        .map((f) => this.buildFilterClause(f))
        .filter((clause): clause is Prisma.Sql => clause !== null);
      if (subClauses.length > 0) {
        parts.push(Prisma.sql`(${Prisma.join(subClauses, ' AND ')})`);
      }
    }

    if (filter.or && filter.or.length > 0) {
      const subClauses = filter.or
        .map((f) => this.buildFilterClause(f))
        .filter((clause): clause is Prisma.Sql => clause !== null);
      if (subClauses.length > 0) {
        parts.push(Prisma.sql`(${Prisma.join(subClauses, ' OR ')})`);
      }
    }

    if (filter.match) {
      const { key, value } = filter.match;
      parts.push(Prisma.sql`metadata ->> ${key} = ${String(value)}`);
    }

    if (filter.range) {
      const { key, gte, lte } = filter.range;
      if (gte !== undefined) {
        parts.push(Prisma.sql`(metadata ->> ${key})::numeric >= ${gte}`);
      }
      if (lte !== undefined) {
        parts.push(Prisma.sql`(metadata ->> ${key})::numeric <= ${lte}`);
      }
    }

    if (filter.in) {
      const { key, values } = filter.in;
      const valueList = values.map((value) => Prisma.sql`${String(value)}`);
      parts.push(
        valueList.length > 0 ? Prisma.sql`metadata ->> ${key} IN (${Prisma.join(valueList)})` : Prisma.sql`FALSE`,
      );
    }

    return parts.length > 0 ? Prisma.join(parts, ' AND ') : null;
  }
}
