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

@Controller('apps')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post()
  create(
    @CurrentUser('userId') userId: string,
    @Body() createAppDto: CreateAppDto,
  ) {
    return this.appService.create(userId, createAppDto);
  }

  @Get()
  findAll(@CurrentUser('userId') userId: string) {
    return this.appService.findAll(userId);
  }

  @Get(':id')
  @RequirePermissions('app:read')
  findOne(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.appService.findOne(userId, id);
  }

  @Patch(':id')
  @RequirePermissions('app:update')
  update(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() updateAppDto: UpdateAppDto,
  ) {
    return this.appService.update(userId, id, updateAppDto);
  }

  @Delete(':id')
  @RequirePermissions('app:delete')
  remove(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.appService.remove(userId, id);
  }

  @Patch(':id/publish')
  @RequirePermissions('app:publish')
  publish(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.appService.publish(userId, id);
  }

  @Patch(':id/unpublish')
  @RequirePermissions('app:publish')
  unpublish(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.appService.unpublish(userId, id);
  }

  @Patch(':id/archive')
  @RequirePermissions('app:delete')
  archive(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.appService.archive(userId, id);
  }

  @Patch(':id/unarchive')
  @RequirePermissions('app:delete')
  unarchive(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.appService.unarchive(userId, id);
  }
}
