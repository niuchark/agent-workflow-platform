/** 模板 DTO 单元测试 */
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QueryTemplateDto } from '../dto/template.dto';

describe('QueryTemplateDto', () => {
  it('converts pagination query strings to numbers', async () => {
    const dto = plainToInstance(QueryTemplateDto, {
      page: '1',
      pageSize: '12',
      sort: 'newest',
    });

    expect(dto.page).toBe(1);
    expect(dto.pageSize).toBe(12);
    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
