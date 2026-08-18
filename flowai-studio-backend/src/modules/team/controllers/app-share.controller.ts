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
import { AppShareService } from '../services/app-share.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions';
import { IsOptional, IsBoolean, IsString, IsArray } from 'class-validator';

class UpdateShareSettingsDto {
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  embedConfig?: {
    allowedOrigins?: string[];
    theme?: string;
  };
}

@Controller('apps')
@UseGuards(JwtAuthGuard)
export class AppShareController {
  constructor(private readonly appShareService: AppShareService) {}

  /**
   * 生成分享链接
   */
  @Post(':appId/share')
  @RequirePermissions(PERMISSIONS.APP_SHARE)
  generateShareLink(
    @CurrentUser('userId') userId: string,
    @Param('appId') appId: string,
  ) {
    return this.appShareService.generateShareLink(userId, appId);
  }

  /**
   * 更新分享设置
   */
  @Patch(':appId/share')
  @RequirePermissions(PERMISSIONS.APP_SHARE)
  updateShareSettings(
    @CurrentUser('userId') userId: string,
    @Param('appId') appId: string,
    @Body() dto: UpdateShareSettingsDto,
  ) {
    return this.appShareService.updateShareSettings(userId, appId, dto);
  }

  /**
   * 撤销分享链接
   */
  @Delete(':appId/share')
  @RequirePermissions(PERMISSIONS.APP_SHARE)
  revokeShareLink(
    @CurrentUser('userId') userId: string,
    @Param('appId') appId: string,
  ) {
    return this.appShareService.revokeShareLink(userId, appId);
  }

  /**
   * 获取嵌入代码
   */
  @Get(':appId/embed')
  @RequirePermissions(PERMISSIONS.APP_SHARE)
  getEmbedCode(
    @CurrentUser('userId') userId: string,
    @Param('appId') appId: string,
  ) {
    return this.appShareService.getEmbedCode(userId, appId);
  }
}

/**
 * 公开分享链接访问（无需认证）
 */
@Controller('share')
export class AppSharePublicController {
  constructor(private readonly appShareService: AppShareService) {}

  @Get(':shareLink')
  getSharedApp(@Param('shareLink') shareLink: string) {
    return this.appShareService.getSharedApp(shareLink);
  }
}
