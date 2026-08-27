/**
 * 应用分享控制器：分享链接管理（认证）+ 公开访问（免认证）。
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AppShareService } from '../services/app-share.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class EmbedConfigDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(?:\.\d+)?(?:px|%|vh|vw|rem|em)$/)
  width?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(?:\.\d+)?(?:px|%|vh|vw|rem|em)$/)
  height?: string;

  @IsOptional()
  @IsIn(['light', 'dark', 'auto'])
  theme?: 'light' | 'dark' | 'auto';

  @IsOptional()
  @IsBoolean()
  showHeader?: boolean;
}

class UpdateShareSettingsDto {
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => EmbedConfigDto)
  embedConfig?: EmbedConfigDto;
}

/** 认证的分享管理控制器 */
@Controller('apps')
@UseGuards(JwtAuthGuard)
export class AppShareController {
  constructor(private readonly appShareService: AppShareService) {}

  /**
   * 获取当前分享设置
   */
  @Get(':appId/share')
  @RequirePermissions(PERMISSIONS.APP_SHARE)
  getShareInfo(
    @CurrentUser('userId') userId: string,
    @Param('appId') appId: string,
  ) {
    return this.appShareService.getShareInfo(userId, appId);
  }

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

  /** 公开访问分享应用（无需登录） */
  @Get(':shareLink')
  getSharedApp(
    @Param('shareLink') shareLink: string,
    @Query('embedded') embedded?: string,
  ) {
    return this.appShareService.getSharedApp(shareLink, embedded === '1');
  }
}
