/**
 * 团队相关 DTO：团队、成员与团队应用关联的请求体定义。
 */
import {
  IsString,
  IsOptional,
  IsNotEmpty,
  MaxLength,
  IsIn,
} from 'class-validator';

// ============ 团队 DTO ============

/** 创建团队请求体 */
export class CreateTeamDto {
  @IsString()
  @IsNotEmpty({ message: '团队名称不能为空' })
  @MaxLength(50, { message: '团队名称最多50个字符' })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: '团队描述最多200个字符' })
  description?: string;

  @IsOptional()
  @IsString()
  avatar?: string;
}

/** 更新团队请求体（部分字段） */
export class UpdateTeamDto {
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: '团队名称最多50个字符' })
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: '团队描述最多200个字符' })
  description?: string;

  @IsOptional()
  @IsString()
  avatar?: string;
}

// ============ 团队成员 DTO ============

/** 添加成员请求体 */
export class AddMemberDto {
  @IsString()
  @IsNotEmpty({ message: '用户名或用户ID不能为空' })
  userId: string;

  @IsString()
  @IsIn(['admin', 'editor', 'viewer'], { message: '角色必须是 admin/editor/viewer' })
  role: string;
}

/** 更新成员角色请求体 */
export class UpdateMemberRoleDto {
  @IsString()
  @IsIn(['admin', 'editor', 'viewer'], { message: '角色必须是 admin/editor/viewer' })
  role: string;
}

// ============ 团队应用关联 DTO ============

/** 添加应用到团队请求体 */
export class AddTeamAppDto {
  @IsString()
  @IsNotEmpty({ message: '应用ID不能为空' })
  applicationId: string;

  @IsString()
  @IsIn(['full_access', 'can_edit', 'can_view'], {
    message: '权限必须是 full_access/can_edit/can_view',
  })
  permission: string;
}

/** 更新团队应用权限请求体 */
export class UpdateTeamAppPermissionDto {
  @IsString()
  @IsIn(['full_access', 'can_edit', 'can_view'], {
    message: '权限必须是 full_access/can_edit/can_view',
  })
  permission: string;
}
