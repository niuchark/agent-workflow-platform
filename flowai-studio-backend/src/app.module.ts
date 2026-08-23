/**
 * 根模块：组装全局配置与所有业务模块。
 *
 * 集中登记：
 * - 全局配置（env 校验）与 JWT 模块；
 * - 基础设施模块（Prisma/Redis/Cache）；
 * - 各业务模块（用户/应用/工作流/RAG/技能/AI/MCP/团队/模型凭证）。
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { envSchema } from './config/env.config';
import { PrismaModule } from './common/modules/prisma.module';
import { RedisModule } from './common/modules/redis.module';
import { CacheModule } from './common/modules/cache.module';
import { UserModule } from './modules/user/user.module';
import { AppModule as ApplicationModule } from './modules/app/app.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { RAGModule } from './modules/rag/rag.module';
import { SkillModule } from './modules/skill/skill.module';
import { AiModule } from './modules/ai/ai.module';
import { McpModule } from './modules/mcp/mcp.module';
import { TeamModule } from './modules/team/team.module';
import { ModelCredentialModule } from './modules/model-credential/model-credential.module';

/** 根模块：导入全局配置、基础设施与全部业务模块 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config: Record<string, any>) => {
        return envSchema.parse(config);
      },
    }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '7d') as JwtSignOptions['expiresIn'],
        },
      }),
    }),
    PrismaModule,
    RedisModule,
    CacheModule,
    UserModule,
    ApplicationModule,
    WorkflowModule,
    RAGModule,
    SkillModule,
    AiModule,
    McpModule,
    TeamModule,
    ModelCredentialModule,
  ],
})
export class AppModule {}
