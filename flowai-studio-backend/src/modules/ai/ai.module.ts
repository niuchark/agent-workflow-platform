/**
 * AI 模块：对话与工作流执行接口。
 *
 * 通过 forwardRef 与 WorkflowModule 互相引用，
 * 以支持 AI 服务触发工作流执行。
 */
import { Module, forwardRef } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { RAGModule } from '../rag/rag.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { PrismaModule } from '../../common/modules/prisma.module';
import { AgentModule } from '../agent/agent.module';

/** AI 模块：注册控制器与服务 */
@Module({
  imports: [PrismaModule, RAGModule, AgentModule, forwardRef(() => WorkflowModule)],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
