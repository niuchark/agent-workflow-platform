/**
 * 创建技能 DTO：定义请求体字段与校验规则。
 */
import { IsString, IsOptional, IsBoolean, IsObject, IsEnum } from 'class-validator';

/** 技能类型：内置 / 自定义 */
export enum SkillType {
  BUILTIN = 'builtin',
  CUSTOM = 'custom',
}

/** 创建技能的请求体 */
export class CreateSkillDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(SkillType)
  type: SkillType;

  @IsString()
  @IsOptional()
  builtinType?: string;

  @IsObject()
  @IsOptional()
  config?: Record<string, any>;

  @IsObject()
  @IsOptional()
  inputSchema?: Record<string, any>;

  @IsObject()
  @IsOptional()
  outputSchema?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
