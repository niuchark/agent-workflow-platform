/**
 * AI 相关 DTO：对话、运行与流式运行的请求体。
 */
import { IsString, IsOptional, IsObject, IsUUID, IsArray, IsIn } from 'class-validator';

/** 运行应用/工作流的请求体 */
export class RunDto {
  @IsUUID('4', { message: 'Invalid application ID' })
  appId: string;

  @IsOptional()
  @IsUUID('4', { message: 'Invalid workflow ID' })
  workflowId?: string;

  @IsObject({ message: 'Inputs must be an object' })
  inputs: Record<string, unknown>;

  @IsOptional()
  @IsString({ message: 'Session ID must be a string' })
  sessionId?: string;
}

/** 流式运行请求体（继承 RunDto） */
export class StreamRunDto extends RunDto {}

/** 对话请求体 */
export class ChatDto {
  @IsString({ message: 'Message must be a string' })
  message: string;

  @IsOptional()
  @IsArray({ message: 'History must be an array' })
  history?: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;

  @IsOptional()
  @IsString({ message: 'Session ID must be a string' })
  sessionId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Invalid knowledge base ID' })
  knowledgeBaseId?: string;

  @IsOptional()
  @IsIn(['qwen', 'openai', 'ollama'])
  provider?: 'qwen' | 'openai' | 'ollama';

  @IsOptional()
  @IsString()
  model?: string;
}
