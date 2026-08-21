/**
 * 更新技能 DTO：所有字段可选（校验规则与创建一致）。
 */
import { IsString, IsOptional, IsBoolean, IsObject, IsEnum } from 'class-validator';
import { SkillType } from './create-skill.dto';

/** 更新技能的请求体（部分字段） */
export class UpdateSkillDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(SkillType)
  @IsOptional()
  type?: SkillType;

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
