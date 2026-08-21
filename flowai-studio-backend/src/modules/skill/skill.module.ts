/**
 * 技能模块：内置/自定义工具的管理与执行。
 */
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/modules/prisma.module';
import { SkillController } from './skill.controller';
import { SkillService } from './services/skill.service';

/** 技能模块：注册控制器与服务，供其他模块复用 */
@Module({
  imports: [PrismaModule],
  controllers: [SkillController],
  providers: [SkillService],
  exports: [SkillService],
})
export class SkillModule {}
