import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyService } from '../services/api-key.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions';
import { IsString, IsOptional, IsNotEmpty, IsArray, IsDateString, IsBoolean } from 'class-validator';

class CreateApiKeyDto {
  @IsString()
  @IsNotEmpty({ message: '密钥名称不能为空' })
  name: string;

  @IsOptional()
  @IsString()
  applicationId?: string;

  @IsOptional()
  @IsArray()
  scopes?: string[];

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

class ToggleApiKeyDto {
  @IsBoolean()
  isActive: boolean;
}

@Controller('api-keys')
@UseGuards(JwtAuthGuard)
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.API_KEY_CREATE)
  create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.apiKeyService.createApiKey(userId, {
      name: dto.name,
      applicationId: dto.applicationId,
      scopes: dto.scopes,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    });
  }

  @Get()
  @RequirePermissions(PERMISSIONS.API_KEY_READ)
  list(
    @CurrentUser('userId') userId: string,
    @Query('applicationId') applicationId?: string,
  ) {
    return this.apiKeyService.listApiKeys(userId, applicationId);
  }

  @Delete(':keyId')
  @RequirePermissions(PERMISSIONS.API_KEY_DELETE)
  delete(
    @CurrentUser('userId') userId: string,
    @Param('keyId') keyId: string,
  ) {
    return this.apiKeyService.deleteApiKey(userId, keyId);
  }

  @Patch(':keyId/toggle')
  @RequirePermissions(PERMISSIONS.API_KEY_DELETE)
  toggle(
    @CurrentUser('userId') userId: string,
    @Param('keyId') keyId: string,
    @Body() dto: ToggleApiKeyDto,
  ) {
    return this.apiKeyService.toggleApiKey(userId, keyId, dto.isActive);
  }
}
