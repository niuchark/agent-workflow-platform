/**
 * BM25KeywordService 单元测试
 *
 * 测试 BM25 关键词检索服务:
 * 1. 文本搜索配置检测
 * 2. LIKE 降级搜索
 * 3. 过滤条件构建
 */
import { BM25KeywordService } from '../bm25-keyword.service';

describe('BM25KeywordService', () => {
  let service: BM25KeywordService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
    };
    service = new BM25KeywordService(mockPrisma);
  });

  describe('detectTextSearchConfig', () => {
    it('should detect zhparser if available', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ cfgname: 'zhparser' }]);

      const config = await service.detectTextSearchConfig();
      expect(config).toBe('zhparser');
    });

    it('should fall back to english if zhparser not available', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ cfgname: 'english' }]);

      const config = await service.detectTextSearchConfig();
      expect(config).toBe('english');
    });

    it('should fall back to simple if no known config', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const config = await service.detectTextSearchConfig();
      expect(config).toBe('simple');
    });

    it('should fall back to simple on error', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection error'));

      const config = await service.detectTextSearchConfig();
      expect(config).toBe('simple');
    });
  });

  describe('search', () => {
    it('should return empty for empty query', async () => {
      const results = await service.search({
        query: '',
        knowledgeBaseId: 'kb1',
      });
      expect(results).toEqual([]);
    });

    it('should return empty for whitespace-only query', async () => {
      const results = await service.search({
        query: '   ',
        knowledgeBaseId: 'kb1',
      });
      expect(results).toEqual([]);
    });

    it('binds query and metadata filters instead of interpolating them', async () => {
      const query = `needle'; DROP TABLE document_chunks; --`;
      const knowledgeBaseId = `kb' OR '1'='1`;
      const filterKey = `source' || content || '`;
      const filterValue = `manual' OR TRUE --`;
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ cfgname: 'english' }]).mockResolvedValueOnce([]);

      await service.search({
        query,
        knowledgeBaseId,
        filter: { [filterKey]: filterValue },
      });

      const statement = mockPrisma.$queryRaw.mock.calls[1][0];
      const sqlText = statement.strings.join('');
      expect(sqlText).not.toContain(query);
      expect(sqlText).not.toContain(knowledgeBaseId);
      expect(sqlText).not.toContain(filterKey);
      expect(sqlText).not.toContain(filterValue);
      expect(statement.values).toEqual(expect.arrayContaining([query, knowledgeBaseId, filterKey, filterValue]));
    });

    it('keeps fallback LIKE search values parameterized', async () => {
      const query = `needle';DROP_TABLE`;
      const knowledgeBaseId = `kb' OR TRUE --`;
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ cfgname: 'english' }])
        .mockRejectedValueOnce(new Error('full-text unavailable'))
        .mockResolvedValueOnce([]);

      await service.search({ query, knowledgeBaseId });

      const statement = mockPrisma.$queryRaw.mock.calls[2][0];
      const sqlText = statement.strings.join('');
      expect(sqlText).not.toContain(query);
      expect(sqlText).not.toContain(knowledgeBaseId);
      expect(statement.values).toEqual(expect.arrayContaining([`%${query}%`, knowledgeBaseId]));
    });
  });

  describe('ensureFullTextIndex', () => {
    it('should create GIN index for full-text search', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ cfgname: 'english' }]);
      mockPrisma.$executeRaw.mockResolvedValue(undefined);

      await service.ensureFullTextIndex();
      expect(mockPrisma.$executeRaw).toHaveBeenCalled();
    });

    it('should handle index creation failure gracefully', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ cfgname: 'simple' }]);
      mockPrisma.$executeRaw.mockRejectedValue(new Error('Index creation failed'));

      // Should not throw
      await expect(service.ensureFullTextIndex()).resolves.toBeUndefined();
    });
  });
});
