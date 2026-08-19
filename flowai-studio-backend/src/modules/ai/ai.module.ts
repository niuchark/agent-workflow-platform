import { Module, forwardRef } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { RAGModule } from '../rag/rag.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { PrismaModule } from '../../common/modules/prisma.module';
import { AgentModule } from '../agent/agent.module';

@Module({
  imports: [PrismaModule, RAGModule, AgentModule, forwardRef(() => WorkflowModule)],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
