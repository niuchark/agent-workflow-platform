/**
 * 更新工作流 DTO：所有字段可选（继承 CreateWorkflowDto 校验）。
 */
import { PartialType } from '@nestjs/mapped-types';
import { CreateWorkflowDto } from './create-workflow.dto';

/** 更新工作流的请求体（部分字段） */
export class UpdateWorkflowDto extends PartialType(CreateWorkflowDto) {}
