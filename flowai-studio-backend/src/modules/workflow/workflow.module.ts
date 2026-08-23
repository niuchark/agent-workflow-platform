/**
 * 工作流模块：工作流 CRUD、执行、版本、模板与 DSL 导入导出。
 *
 * 依赖 RAG/Skill/AI/Agent 模块以支持各类型节点的执行；
 * 通过 forwardRef 解决 AiModule 与执行器之间的循环依赖。
 */
import { Module, forwardRef } from '@nestjs/common';
import { WorkflowController } from './workflow.controller';
import { WorkflowVersionController } from './controllers/workflow-version.controller';
import { WorkflowTemplateController } from './controllers/workflow-template.controller';
import { WorkflowDslController } from './controllers/workflow-dsl.controller';
import { WorkflowTraceController } from './controllers/workflow-trace.controller';
import { WorkflowService } from './workflow.service';
import { WorkflowExecutorService } from './services/workflow-executor.service';
import { WorkflowVersionService } from './services/workflow-version.service';
import { WorkflowTemplateService } from './services/workflow-template.service';
import { WorkflowDslService } from './services/workflow-dsl.service';
import { TracingService } from './services/tracing.service';
import { NodeExecutorFactory } from './services/node-executor.factory';
import { StartNodeExecutor } from './services/node-executors/start-node.executor';
import { UserInputNodeExecutor } from './services/node-executors/user-input-node.executor';
import { LLMNodeExecutor } from './services/node-executors/llm-node.executor';
import { RAGNodeExecutor } from './services/node-executors/rag-node.executor';
import { SkillNodeExecutor } from './services/node-executors/skill-node.executor';
import { ConditionNodeExecutor } from './services/node-executors/condition-node.executor';
import { OutputNodeExecutor } from './services/node-executors/output-node.executor';
import { AgentNodeExecutor } from './services/node-executors/agent-node.executor';
import { PrismaModule } from '../../common/modules/prisma.module';
import { RAGModule } from '../rag/rag.module';
import { SkillModule } from '../skill/skill.module';
import { AiModule } from '../ai/ai.module';
import { AgentModule } from '../agent/agent.module';
import { RateLimiterService, CircuitBreakerService } from '../../common/services/rate-limit.service';

/** 工作流模块：注册控制器、执行服务与全部节点执行器 */
@Module({
  imports: [PrismaModule, RAGModule, SkillModule, forwardRef(() => AiModule), AgentModule],
  controllers: [WorkflowController, WorkflowVersionController, WorkflowTemplateController, WorkflowDslController, WorkflowTraceController],
  providers: [
    RateLimiterService,
    CircuitBreakerService,
    TracingService,
    WorkflowService,
    WorkflowExecutorService,
    WorkflowVersionService,
    WorkflowTemplateService,
    WorkflowDslService,
    NodeExecutorFactory,
    StartNodeExecutor,
    UserInputNodeExecutor,
    LLMNodeExecutor,
    RAGNodeExecutor,
    SkillNodeExecutor,
    ConditionNodeExecutor,
    OutputNodeExecutor,
    AgentNodeExecutor,
  ],
  exports: [WorkflowExecutorService],
})
export class WorkflowModule {}
