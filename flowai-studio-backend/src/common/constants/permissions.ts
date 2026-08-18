/**
 * RBAC 权限常量定义
 *
 * 权限格式: resource:action
 * - resource: 操作的资源类型 (app, workflow, knowledge-base, skill, team, api-key, template)
 * - action: 操作类型 (create, read, update, delete, execute, publish, share, manage)
 */

// ============================================================
// 权限定义
// ============================================================

export const PERMISSIONS = {
  // 应用权限
  APP_CREATE: 'app:create',
  APP_READ: 'app:read',
  APP_UPDATE: 'app:update',
  APP_DELETE: 'app:delete',
  APP_PUBLISH: 'app:publish',
  APP_SHARE: 'app:share',

  // 工作流权限
  WORKFLOW_CREATE: 'workflow:create',
  WORKFLOW_READ: 'workflow:read',
  WORKFLOW_UPDATE: 'workflow:update',
  WORKFLOW_DELETE: 'workflow:delete',
  WORKFLOW_EXECUTE: 'workflow:execute',

  // 知识库权限
  KB_CREATE: 'kb:create',
  KB_READ: 'kb:read',
  KB_UPDATE: 'kb:update',
  KB_DELETE: 'kb:delete',

  // 技能权限
  SKILL_CREATE: 'skill:create',
  SKILL_READ: 'skill:read',
  SKILL_UPDATE: 'skill:update',
  SKILL_DELETE: 'skill:delete',

  // 团队权限
  TEAM_CREATE: 'team:create',
  TEAM_READ: 'team:read',
  TEAM_UPDATE: 'team:update',
  TEAM_DELETE: 'team:delete',
  TEAM_MANAGE_MEMBERS: 'team:manage-members',

  // API 密钥权限
  API_KEY_CREATE: 'api-key:create',
  API_KEY_READ: 'api-key:read',
  API_KEY_DELETE: 'api-key:delete',

  // 模板权限
  TEMPLATE_CREATE: 'template:create',
  TEMPLATE_READ: 'template:read',
  TEMPLATE_UPDATE: 'template:update',
  TEMPLATE_DELETE: 'template:delete',
  TEMPLATE_PUBLISH: 'template:publish',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// ============================================================
// 角色定义
// ============================================================

export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  EDITOR: 'editor',
  VIEWER: 'viewer',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

// ============================================================
// 角色 → 权限映射
// ============================================================

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [ROLES.OWNER]: Object.values(PERMISSIONS), // owner 拥有全部权限
  [ROLES.ADMIN]: Object.values(PERMISSIONS), // admin 拥有全部权限
  [ROLES.EDITOR]: [
    PERMISSIONS.APP_READ,
    PERMISSIONS.APP_UPDATE,
    PERMISSIONS.WORKFLOW_CREATE,
    PERMISSIONS.WORKFLOW_READ,
    PERMISSIONS.WORKFLOW_UPDATE,
    PERMISSIONS.WORKFLOW_DELETE,
    PERMISSIONS.WORKFLOW_EXECUTE,
    PERMISSIONS.KB_CREATE,
    PERMISSIONS.KB_READ,
    PERMISSIONS.KB_UPDATE,
    PERMISSIONS.SKILL_CREATE,
    PERMISSIONS.SKILL_READ,
    PERMISSIONS.SKILL_UPDATE,
    PERMISSIONS.TEMPLATE_CREATE,
    PERMISSIONS.TEMPLATE_READ,
    PERMISSIONS.TEMPLATE_UPDATE,
    PERMISSIONS.API_KEY_READ,
  ],
  [ROLES.VIEWER]: [
    PERMISSIONS.APP_READ,
    PERMISSIONS.WORKFLOW_READ,
    PERMISSIONS.KB_READ,
    PERMISSIONS.SKILL_READ,
    PERMISSIONS.TEMPLATE_READ,
    PERMISSIONS.API_KEY_READ,
  ],
};

/**
 * 检查角色是否拥有指定权限
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * 获取角色的所有权限
 */
export function getRolePermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

// ============================================================
// 团队应用权限级别
// ============================================================

export const TEAM_APP_PERMISSIONS = {
  FULL_ACCESS: 'full_access',
  CAN_EDIT: 'can_edit',
  CAN_VIEW: 'can_view',
} as const;

export type TeamAppPermission = typeof TEAM_APP_PERMISSIONS[keyof typeof TEAM_APP_PERMISSIONS];

/**
 * 团队应用权限 → 可执行操作映射
 */
const TEAM_APP_PERMISSION_ACTIONS: Record<TeamAppPermission, Permission[]> = {
  [TEAM_APP_PERMISSIONS.FULL_ACCESS]: [
    PERMISSIONS.APP_READ,
    PERMISSIONS.APP_UPDATE,
    PERMISSIONS.APP_DELETE,
    PERMISSIONS.APP_PUBLISH,
    PERMISSIONS.APP_SHARE,
    PERMISSIONS.WORKFLOW_CREATE,
    PERMISSIONS.WORKFLOW_READ,
    PERMISSIONS.WORKFLOW_UPDATE,
    PERMISSIONS.WORKFLOW_DELETE,
    PERMISSIONS.WORKFLOW_EXECUTE,
  ],
  [TEAM_APP_PERMISSIONS.CAN_EDIT]: [
    PERMISSIONS.APP_READ,
    PERMISSIONS.APP_UPDATE,
    PERMISSIONS.WORKFLOW_CREATE,
    PERMISSIONS.WORKFLOW_READ,
    PERMISSIONS.WORKFLOW_UPDATE,
    PERMISSIONS.WORKFLOW_EXECUTE,
  ],
  [TEAM_APP_PERMISSIONS.CAN_VIEW]: [
    PERMISSIONS.APP_READ,
    PERMISSIONS.WORKFLOW_READ,
  ],
};

/**
 * 检查团队应用权限是否覆盖指定操作
 */
export function teamAppHasPermission(
  teamAppPermission: TeamAppPermission,
  permission: Permission,
): boolean {
  return TEAM_APP_PERMISSION_ACTIONS[teamAppPermission]?.includes(permission) ?? false;
}

// ============================================================
// API Key Scopes
// ============================================================

export const API_KEY_SCOPES = {
  APP_READ: 'app:read',
  WORKFLOW_EXECUTE: 'workflow:execute',
  WORKFLOW_READ: 'workflow:read',
} as const;
