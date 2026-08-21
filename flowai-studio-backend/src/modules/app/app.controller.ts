/**
 * 应用控制器：暴露应用 CRUD 与生命周期操作的 REST 接口。
 *
 * 所有接口需要 JWT 认证；涉及资源的操作（读/改/删/发布/归档）
 * 由 PermissionGuard 按所有权与团队权限校验。
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
import { AppService } from './app.service';
import { CreateAppDto } from './dto/create-app.dto';
import { UpdateAppDto } from './dto/update-app.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

/** 应用 REST 控制器 */
@Controller('apps')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AppController {
  constructor(private readonly appService: AppService) {}

  /** 创建应用 */
  @Post()
  create(
    @CurrentUser('userId') userId: string,
    @Body() createAppDto: CreateAppDto,
  ) {
    return this.appService.create(userId, createAppDto);
  }

  /** 获取当前用户的应用列表 */
  @Get()
  findAll(@CurrentUser('userId') userId: string) {
    return this.appService.findAll(userId);
  }

  /** 获取应用详情 */
  @Get(':id')
  @RequirePermissions('app:read')
  findOne(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.appService.findOne(userId, id);
  }

  /** 更新应用信息 */
  @Patch(':id')
  @RequirePermissions('app:update')
  update(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() updateAppDto: UpdateAppDto,
  ) {
    return this.appService.update(userId, id, updateAppDto);
  }

  /** 删除应用 */
  @Delete(':id')
  @RequirePermissions('app:delete')
  remove(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.appService.remove(userId, id);
  }

  /** 发布应用 */
  @Patch(':id/publish')
  @RequirePermissions('app:publish')
  publish(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.appService.publish(userId, id);
  }

  /** 取消发布 */
  @Patch(':id/unpublish')
  @RequirePermissions('app:publish')
  unpublish(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.appService.unpublish(userId, id);
  }

  /** 归档应用 */
  @Patch(':id/archive')
  @RequirePermissions('app:delete')
  archive(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.appService.archive(userId, id);
  }

  /** 取消归档 */
  @Patch(':id/unarchive')
  @RequirePermissions('app:delete')
  unarchive(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.appService.unarchive(userId, id);
  }
}
