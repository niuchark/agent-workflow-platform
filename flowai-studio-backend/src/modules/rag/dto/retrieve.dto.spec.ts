import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RetrieveDto } from './retrieve.dto';

describe('RetrieveDto', () => {
  it('accepts a valid retrieval request', async () => {
    const dto = plainToInstance(RetrieveDto, {
      query: '如何部署工作流？',
      knowledgeBaseId: '9c77d1c6-572c-49bb-a1a6-7e7ee3f3af34',
      topK: 5,
      retrievalMode: 'hybrid',
      vectorWeight: 0.7,
      rrfK: 60,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects a non-numeric SQL fragment in topK', async () => {
    const dto = plainToInstance(RetrieveDto, {
      query: 'test',
      knowledgeBaseId: '9c77d1c6-572c-49bb-a1a6-7e7ee3f3af34',
      topK: '1; DROP TABLE document_chunks',
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'topK')).toBe(true);
  });
});
