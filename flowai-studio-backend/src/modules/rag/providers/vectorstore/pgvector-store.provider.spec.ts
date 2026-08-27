import { PrismaService } from '../../../../common/services/prisma.service';
import { PgVectorStore } from './pgvector-store.provider';

describe('PgVectorStore parameterized SQL', () => {
  let store: PgVectorStore;
  let prisma: {
    $queryRaw: jest.Mock;
    $executeRaw: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
    };
    store = new PgVectorStore(prisma as unknown as PrismaService);
  });

  it('binds vector and metadata filters and always selects metadata', async () => {
    const filterKey = `source' || content || '`;
    const filterValue = `manual' OR TRUE --`;
    prisma.$queryRaw.mockResolvedValue([
      {
        id: 'chunk-1',
        content: 'result',
        similarity: 0.81234,
        metadata: JSON.stringify({ source: 'manual' }),
      },
    ]);

    const result = await store.search('kb-1', {
      queryVector: [0.1, 0.2],
      similarityThreshold: 0.5,
      filter: { match: { key: filterKey, value: filterValue } },
    });

    const statement = prisma.$queryRaw.mock.calls[0][0];
    const sqlText = statement.strings.join('');
    expect(sqlText).toContain('metadata');
    expect(sqlText).not.toContain(filterKey);
    expect(sqlText).not.toContain(filterValue);
    expect(statement.values).toEqual(expect.arrayContaining(['[0.1,0.2]', 0.5, filterKey, filterValue]));
    expect(result[0]).toEqual(
      expect.objectContaining({
        metadata: { source: 'manual' },
        similarity: 0.8123,
      }),
    );
  });

  it('binds document values during upsert', async () => {
    const id = `chunk'); DELETE FROM document_chunks; --`;
    const content = `content', NULL); DROP TABLE documents; --`;
    const metadata = { source: `manual' OR TRUE --` };
    prisma.$executeRaw.mockResolvedValue(1);

    await store.upsert('kb-1', [{ id, content, embedding: [0.3, 0.4], metadata }]);

    const insertStatement = prisma.$executeRaw.mock.calls[1][0];
    const sqlText = insertStatement.strings.join('');
    expect(sqlText).not.toContain(id);
    expect(sqlText).not.toContain(content);
    expect(sqlText).not.toContain(metadata.source);
    expect(insertStatement.values).toEqual(
      expect.arrayContaining([id, content, '[0.3,0.4]', JSON.stringify(metadata)]),
    );
  });

  it('binds IDs and filter fields during deletion', async () => {
    const id = `chunk') OR TRUE --`;
    const filterKey = `documentId' || content || '`;
    const filterValue = `doc' OR TRUE --`;
    prisma.$executeRaw.mockResolvedValue(1);

    await store.delete('kb-1', [id]);
    await store.deleteByFilter('kb-1', {
      match: { key: filterKey, value: filterValue },
    });

    for (const [statement] of prisma.$executeRaw.mock.calls) {
      const sqlText = statement.strings.join('');
      expect(sqlText).not.toContain(id);
      expect(sqlText).not.toContain(filterKey);
      expect(sqlText).not.toContain(filterValue);
    }
    expect(prisma.$executeRaw.mock.calls[0][0].values).toContain(id);
    expect(prisma.$executeRaw.mock.calls[1][0].values).toEqual(expect.arrayContaining([filterKey, filterValue]));
  });
});
