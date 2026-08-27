/**
 * MCP API DTOs.
 *
 * Stdio MCP is an operator-controlled capability: request validation only
 * describes the stored configuration. McpService additionally enforces the
 * deployment opt-in and executable allowlist before starting a process.
 */
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export enum McpTransportType {
  STDIO = 'stdio',
  SSE = 'sse',
}

/** Create an MCP server configuration. */
export class CreateMcpServerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(McpTransportType)
  transportType?: McpTransportType;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  command?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(64)
  @IsString({ each: true })
  args?: string[];

  @IsOptional()
  @IsObject()
  env?: Record<string, string>;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  url?: string;
}

/** Update an MCP server configuration. */
export class UpdateMcpServerDto extends PartialType(CreateMcpServerDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Invoke one tool on a connected MCP server. */
export class CallMcpToolDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  toolName: string;

  @IsOptional()
  @IsObject()
  args?: Record<string, unknown>;
}
