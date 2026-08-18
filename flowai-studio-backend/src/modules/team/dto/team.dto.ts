import {
  IsString,
  IsOptional,
  IsNotEmpty,
  MaxLength,
  IsArray,
  IsIn,
} from 'class-validator';

// ============================================================
// 团队 DTO
// ============================================================

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

// ============================================================
// 团队成员 DTO
// ============================================================

export class AddMemberDto {
  @IsString()
  @IsNotEmpty({ message: '用户ID不能为空' })
  userId: string;

  @IsString()
  @IsIn(['admin', 'editor', 'viewer'], { message: '角色必须是 admin/editor/viewer' })
  role: string;
}

export class UpdateMemberRoleDto {
  @IsString()
  @IsIn(['admin', 'editor', 'viewer'], { message: '角色必须是 admin/editor/viewer' })
  role: string;
}

// ============================================================
// 团队应用关联 DTO
// ============================================================

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

export class UpdateTeamAppPermissionDto {
  @IsString()
  @IsIn(['full_access', 'can_edit', 'can_view'], {
    message: '权限必须是 full_access/can_edit/can_view',
  })
  permission: string;
}
