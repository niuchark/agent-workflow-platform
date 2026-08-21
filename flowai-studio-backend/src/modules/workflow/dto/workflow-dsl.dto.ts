/**
 * DSL 导入导出 DTO：YAML/JSON 两种格式的导入校验与导出参数。
 */
import { IsString, IsOptional, IsEnum, IsArray, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DSL 导入导出 DTO
 *
 * Phase 6.1: Workflow DSL 导入导出
 * - 支持 YAML / JSON 两种格式
 * - 版本兼容性校验
 * - 节点类型校验
 */

/** DSL 支持的文件格式 */
export type DslFormat = 'yaml' | 'json';

/** 导入 DSL 的请求体 */
export class ImportWorkflowDslDto {
  @IsString({ message: 'DSL content is required' })
  dsl!: string;

  @IsEnum(['yaml', 'json'], { message: 'Format must be yaml or json' })
  format!: DslFormat;

  @IsString({ message: 'Application ID is required' })
  applicationId!: string;

  @IsOptional()
  @IsString({ message: 'Workflow name override must be a string' })
  nameOverride?: string;
}

/** 导出 DSL 的请求体（仅格式） */
export class ExportWorkflowDslDto {
  @IsEnum(['yaml', 'json'], { message: 'Format must be yaml or json' })
  format!: DslFormat;
}
