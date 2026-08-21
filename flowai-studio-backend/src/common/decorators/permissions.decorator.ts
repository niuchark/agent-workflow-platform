/**
 * 权限装饰器：标记接口所需的 RBAC 权限。
 */
import { SetMetadata } from '@nestjs/common';
import { PERMISSIONS, Permission } from '../constants/permissions';

/** 权限元数据的键名（与 PermissionGuard 约定一致） */
export const PERMISSIONS_KEY = 'permissions';

/**
 * 装饰器：标记接口所需权限
 *
 * @example
 * @RequirePermissions(PERMISSIONS.APP_UPDATE)
 * @Patch(':id')
 * updateApp() { ... }
 */
/** 声明接口所需权限：多个权限之间为"与"关系（需全部满足） */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
