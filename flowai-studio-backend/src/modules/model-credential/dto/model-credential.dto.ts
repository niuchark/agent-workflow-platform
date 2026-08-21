/**
 * 模型凭证 DTO：保存、测试与启停的请求体。
 */
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/** 保存/更新凭证请求体（clearApiKey 表示清空已保存密钥） */
export class UpsertModelCredentialDto {
  @IsString()
  @MaxLength(2048)
  baseUrl: string;

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  apiKey?: string;

  @IsOptional()
  @IsBoolean()
  clearApiKey?: boolean;
}

/** 测试连通性请求体 */
export class TestModelCredentialDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  model?: string;
}

/** 设置启用状态请求体 */
export class SetModelCredentialStatusDto {
  @IsBoolean()
  enabled: boolean;
}
