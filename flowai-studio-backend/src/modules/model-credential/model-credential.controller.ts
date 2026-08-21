/**
 * 模型凭证控制器：凭证的保存、测试、启停、删除与模型列表。
 */
import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  SetModelCredentialStatusDto,
  TestModelCredentialDto,
  UpsertModelCredentialDto,
} from './dto/model-credential.dto';
import { ModelCredentialService } from './model-credential.service';

/** 模型凭证 REST 控制器 */
@Controller('model-credentials')
@UseGuards(JwtAuthGuard)
export class ModelCredentialController {
  constructor(private readonly credentials: ModelCredentialService) {}

  /** 获取所有供应商的凭证摘要 */
  @Get()
  list(@CurrentUser('userId') userId: string) {
    return this.credentials.list(userId);
  }

  /** 保存/更新某供应商凭证 */
  @Put(':provider')
  upsert(
    @CurrentUser('userId') userId: string,
    @Param('provider') provider: string,
    @Body() dto: UpsertModelCredentialDto,
  ) {
    return this.credentials.upsert(userId, provider, dto);
  }

  /** 设置启用状态 */
  @Patch(':provider/status')
  setStatus(
    @CurrentUser('userId') userId: string,
    @Param('provider') provider: string,
    @Body() dto: SetModelCredentialStatusDto,
  ) {
    return this.credentials.setEnabled(userId, provider, dto.enabled);
  }

  /** 删除凭证 */
  @Delete(':provider')
  remove(
    @CurrentUser('userId') userId: string,
    @Param('provider') provider: string,
  ) {
    return this.credentials.remove(userId, provider);
  }

  /** 测试连通性 */
  @Post(':provider/test')
  test(
    @CurrentUser('userId') userId: string,
    @Param('provider') provider: string,
    @Body() dto: TestModelCredentialDto,
  ) {
    return this.credentials.test(userId, provider, dto.model);
  }

  /** 拉取该供应商的可用模型 */
  @Get(':provider/models')
  models(
    @CurrentUser('userId') userId: string,
    @Param('provider') provider: string,
  ) {
    return this.credentials.listModels(userId, provider);
  }
}
