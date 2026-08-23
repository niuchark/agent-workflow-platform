import { PrismaService } from '../prisma.service';

describe('PrismaService vector writes', () => {
  it('binds chunk content, metadata, document ID, and vector values', async () => {
    const executeRaw = jest.fn().mockResolvedValue(1);
    const service = { $executeRaw: executeRaw } as unknown as PrismaService;
    const documentId = `doc'); DROP TABLE documents; --`;
    const content = `chunk', NULL); DELETE FROM document_chunks; --`;
    const metadata = JSON.stringify({ source: `manual' OR TRUE --` });

    await PrismaService.prototype.batchInsertVectorChunks.call(service, {
      documentId,
      chunks: [
        {
          content,
          embedding: [0.1, 0.2],
          chunkIndex: 0,
          startIndex: 0,
          endIndex: content.length,
          metadata,
        },
      ],
    });

    const statement = executeRaw.mock.calls[0][0];
    const sqlText = statement.strings.join('');
    expect(sqlText).not.toContain(documentId);
    expect(sqlText).not.toContain(content);
    expect(sqlText).not.toContain(metadata);
    expect(statement.values).toEqual(expect.arrayContaining([documentId, content, '[0.1,0.2]', metadata]));
  });
});
