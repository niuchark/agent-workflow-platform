/**
 * Prisma 全局模块：向所有模块提供 PrismaService。
 */
import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../services/prisma.service';

/** 全局 Prisma 模块 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
