/**
 * MCP 模块：外部 MCP 服务器的配置、连接与工具调用。
 */
import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';

/** MCP 模块：注册控制器与服务 */
@Module({
  controllers: [McpController],
  providers: [McpService],
  exports: [McpService],
})
export class McpModule {}
