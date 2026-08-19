import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  SetModelCredentialStatusDto,
  TestModelCredentialDto,
  UpsertModelCredentialDto,
} from './dto/model-credential.dto';
import { ModelCredentialService } from './model-credential.service';

@Controller('model-credentials')
@UseGuards(JwtAuthGuard)
export class ModelCredentialController {
  constructor(private readonly credentials: ModelCredentialService) {}

  @Get()
  list(@CurrentUser('userId') userId: string) {
    return this.credentials.list(userId);
  }

  @Put(':provider')
  upsert(
    @CurrentUser('userId') userId: string,
    @Param('provider') provider: string,
    @Body() dto: UpsertModelCredentialDto,
  ) {
    return this.credentials.upsert(userId, provider, dto);
  }

  @Patch(':provider/status')
  setStatus(
    @CurrentUser('userId') userId: string,
    @Param('provider') provider: string,
    @Body() dto: SetModelCredentialStatusDto,
  ) {
    return this.credentials.setEnabled(userId, provider, dto.enabled);
  }

  @Delete(':provider')
  remove(
    @CurrentUser('userId') userId: string,
    @Param('provider') provider: string,
  ) {
    return this.credentials.remove(userId, provider);
  }

  @Post(':provider/test')
  test(
    @CurrentUser('userId') userId: string,
    @Param('provider') provider: string,
    @Body() dto: TestModelCredentialDto,
  ) {
    return this.credentials.test(userId, provider, dto.model);
  }

  @Get(':provider/models')
  models(
    @CurrentUser('userId') userId: string,
    @Param('provider') provider: string,
  ) {
    return this.credentials.listModels(userId, provider);
  }
}
