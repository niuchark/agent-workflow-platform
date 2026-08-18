import { IsString, IsNumber, IsOptional, IsDateString, IsEnum, Min } from 'class-validator';

export enum CallType {
  CHAT = 'chat',
  EMBEDDING = 'embedding',
  AGENT = 'agent',
}

/**
 * 记录 Token 使用量
 */
export class RecordTokenUsageDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsString()
  applicationId?: string;

  @IsOptional()
  @IsString()
  workflowId?: string;

  @IsOptional()
  @IsString()
  executionId?: string;

  @IsString()
  provider: string;

  @IsString()
  model: string;

  @IsNumber()
  @Min(0)
  promptTokens: number;

  @IsNumber()
  @Min(0)
  completionTokens: number;

  @IsNumber()
  @Min(0)
  totalTokens: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @IsOptional()
  @IsEnum(CallType)
  callType?: CallType;
}

/**
 * 查询 Token 使用量 — 时间范围过滤
 */
export class GetTokenUsageDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  applicationId?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsEnum(CallType)
  callType?: CallType;
}

/**
 * 成本报表查询
 */
export class GetCostReportDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  applicationId?: string;

  /**
   * 分组维度: day, week, month, model, provider
   */
  @IsOptional()
  @IsString()
  groupBy?: 'day' | 'week' | 'month' | 'model' | 'provider';
}
