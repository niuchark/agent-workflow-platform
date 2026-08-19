import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

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

export class TestModelCredentialDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  model?: string;
}

export class SetModelCredentialStatusDto {
  @IsBoolean()
  enabled: boolean;
}
