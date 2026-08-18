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

@Controller('teams')
@UseGuards(JwtAuthGuard)
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  // ============================================================
  // 团队 CRUD
  // ============================================================

  @Post()
  @RequirePermissions(PERMISSIONS.TEAM_CREATE)
  create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateTeamDto,
  ) {
    return this.teamService.create(userId, dto);
  }

  @Get()
  listMyTeams(@CurrentUser('userId') userId: string) {
    return this.teamService.listMyTeams(userId);
  }

  @Get(':teamId')
  @RequirePermissions(PERMISSIONS.TEAM_READ)
  getTeam(
    @CurrentUser('userId') userId: string,
    @Param('teamId') teamId: string,
  ) {
    return this.teamService.getTeam(userId, teamId);
  }

  @Patch(':teamId')
  @RequirePermissions(PERMISSIONS.TEAM_UPDATE)
  update(
    @CurrentUser('userId') userId: string,
    @Param('teamId') teamId: string,
    @Body() dto: UpdateTeamDto,
  ) {
    return this.teamService.update(userId, teamId, dto);
  }

  @Delete(':teamId')
  @RequirePermissions(PERMISSIONS.TEAM_DELETE)
  delete(
    @CurrentUser('userId') userId: string,
    @Param('teamId') teamId: string,
  ) {
    return this.teamService.delete(userId, teamId);
  }

  // ============================================================
  // 成员管理
  // ============================================================

  @Post(':teamId/members')
  @RequirePermissions(PERMISSIONS.TEAM_MANAGE_MEMBERS)
  addMember(
    @CurrentUser('userId') userId: string,
    @Param('teamId') teamId: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.teamService.addMember(userId, teamId, dto);
  }

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

  @Delete(':teamId/members/:memberId')
  @RequirePermissions(PERMISSIONS.TEAM_MANAGE_MEMBERS)
  removeMember(
    @CurrentUser('userId') userId: string,
    @Param('teamId') teamId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.teamService.removeMember(userId, teamId, memberId);
  }

  @Post(':teamId/leave')
  leaveTeam(
    @CurrentUser('userId') userId: string,
    @Param('teamId') teamId: string,
  ) {
    return this.teamService.leaveTeam(userId, teamId);
  }

  // ============================================================
  // 团队应用关联
  // ============================================================

  @Post(':teamId/apps')
  @RequirePermissions(PERMISSIONS.TEAM_UPDATE)
  addApp(
    @CurrentUser('userId') userId: string,
    @Param('teamId') teamId: string,
    @Body() dto: AddTeamAppDto,
  ) {
    return this.teamService.addApp(userId, teamId, dto);
  }

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
