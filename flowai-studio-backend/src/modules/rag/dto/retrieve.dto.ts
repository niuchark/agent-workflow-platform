/** RAG 检索请求：统一校验 HTTP 与服务层约定的检索参数。 */
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class RetrieveDto {
  @IsString()
  @IsNotEmpty()
  query: string;

  @IsUUID()
  knowledgeBaseId: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  topK?: number;

  @IsOptional()
  @IsIn(['vector', 'keyword', 'hybrid'])
  retrievalMode?: 'vector' | 'keyword' | 'hybrid';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  vectorWeight?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  rrfK?: number;
}
