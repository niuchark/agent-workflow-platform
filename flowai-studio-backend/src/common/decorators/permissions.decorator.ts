import { SetMetadata } from '@nestjs/common';
import { PERMISSIONS, Permission } from '../constants/permissions';

export const PERMISSIONS_KEY = 'permissions';

/**
 * 装饰器：标记接口所需权限
 *
 * @example
 * @RequirePermissions(PERMISSIONS.APP_UPDATE)
 * @Patch(':id')
 * updateApp() { ... }
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
