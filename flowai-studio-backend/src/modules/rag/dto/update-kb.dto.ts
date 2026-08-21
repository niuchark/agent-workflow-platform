/**
 * 更新知识库 DTO：所有字段可选（继承 CreateKnowledgeBaseDto 校验）。
 */
import { PartialType } from '@nestjs/mapped-types';
import { CreateKnowledgeBaseDto } from './create-kb.dto';

export class UpdateKnowledgeBaseDto extends PartialType(CreateKnowledgeBaseDto) {}
