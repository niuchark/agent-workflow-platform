/**
 * 当前用户装饰器：从请求上下文取出 JWT 认证后的用户信息。
 *
 * 用法：@CurrentUser() user: CurrentUserPayload 或
 * @CurrentUser('userId') userId: string。
 */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/** JWT 认证后写入 request.user 的用户负载 */
interface CurrentUserPayload {
  userId: string;
  username: string;
}

/** 参数装饰器：读取 request.user，可按字段名取子属性 */
export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user as CurrentUserPayload | undefined;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
