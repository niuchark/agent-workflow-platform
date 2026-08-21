/**
 * 团队控制器：团队 CRUD、成员管理与应用授权接口。
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { TeamService } from '../services/team.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions';
import {
  CreateTeamDto,
  UpdateTeamDto,
  AddMemberDto,
  UpdateMemberRoleDto,
  AddTeamAppDto,
  UpdateTeamAppPermissionDto,
} from '../dto/team.dto';

/** 团队 REST 控制器 */
@Controller('teams')
@UseGuards(JwtAuthGuard)
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  // ============ 团队 CRUD ============

  /** 创建团队 */
  @Post()
  @RequirePermissions(PERMISSIONS.TEAM_CREATE)
  create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateTeamDto,
  ) {
    return this.teamService.create(userId, dto);
  }

  /** 获取我的团队列表 */
  @Get()
  listMyTeams(@CurrentUser('userId') userId: string) {
    return this.teamService.listMyTeams(userId);
  }

  /** 获取团队详情 */
  @Get(':teamId')
  @RequirePermissions(PERMISSIONS.TEAM_READ)
  getTeam(
    @CurrentUser('userId') userId: string,
    @Param('teamId') teamId: string,
  ) {
    return this.teamService.getTeam(userId, teamId);
  }

  /** 更新团队信息 */
  @Patch(':teamId')
  @RequirePermissions(PERMISSIONS.TEAM_UPDATE)
  update(
    @CurrentUser('userId') userId: string,
    @Param('teamId') teamId: string,
    @Body() dto: UpdateTeamDto,
  ) {
    return this.teamService.update(userId, teamId, dto);
  }

  /** 删除团队 */
  @Delete(':teamId')
  @RequirePermissions(PERMISSIONS.TEAM_DELETE)
  delete(
    @CurrentUser('userId') userId: string,
    @Param('teamId') teamId: string,
  ) {
    return this.teamService.delete(userId, teamId);
  }

  // ============ 成员管理 ============

  /** 添加成员 */
  @Post(':teamId/members')
  @RequirePermissions(PERMISSIONS.TEAM_MANAGE_MEMBERS)
  addMember(
    @CurrentUser('userId') userId: string,
    @Param('teamId') teamId: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.teamService.addMember(userId, teamId, dto);
  }

  /** 修改成员角色 */
  @Patch(':teamId/members/:memberId')
  @RequirePermissions(PERMISSIONS.TEAM_MANAGE_MEMBERS)
  updateMemberRole(
    @CurrentUser('userId') userId: string,
    @Param('teamId') teamId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.teamService.updateMemberRole(userId, teamId, memberId, dto);
  }

  /** 移除成员 */
  @Delete(':teamId/members/:memberId')
  @RequirePermissions(PERMISSIONS.TEAM_MANAGE_MEMBERS)
  removeMember(
    @CurrentUser('userId') userId: string,
    @Param('teamId') teamId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.teamService.removeMember(userId, teamId, memberId);
  }

  /** 离开团队 */
  @Post(':teamId/leave')
  leaveTeam(
    @CurrentUser('userId') userId: string,
    @Param('teamId') teamId: string,
  ) {
    return this.teamService.leaveTeam(userId, teamId);
  }

  // ============ 团队应用关联 ============

  /** 添加应用到团队 */
  @Post(':teamId/apps')
  @RequirePermissions(PERMISSIONS.TEAM_UPDATE)
  addApp(
    @CurrentUser('userId') userId: string,
    @Param('teamId') teamId: string,
    @Body() dto: AddTeamAppDto,
  ) {
    return this.teamService.addApp(userId, teamId, dto);
  }

  /** 调整团队应用权限 */
  @Patch(':teamId/apps/:teamAppId')
  @RequirePermissions(PERMISSIONS.TEAM_UPDATE)
  updateAppPermission(
    @CurrentUser('userId') userId: string,
    @Param('teamId') teamId: string,
    @Param('teamAppId') teamAppId: string,
    @Body() dto: UpdateTeamAppPermissionDto,
  ) {
    return this.teamService.updateAppPermission(userId, teamId, teamAppId, dto);
  }

  /** 从团队移除应用 */
  @Delete(':teamId/apps/:teamAppId')
  @RequirePermissions(PERMISSIONS.TEAM_UPDATE)
  removeApp(
    @CurrentUser('userId') userId: string,
    @Param('teamId') teamId: string,
    @Param('teamAppId') teamAppId: string,
  ) {
    return this.teamService.removeApp(userId, teamId, teamAppId);
  }
}
