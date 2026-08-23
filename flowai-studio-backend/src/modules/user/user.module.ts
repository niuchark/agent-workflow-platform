/**
 * 用户模块：注册、登录与个人资料。
 */
import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';

/** 用户模块：注册 JWT 并暴露用户服务 */
@Module({
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
