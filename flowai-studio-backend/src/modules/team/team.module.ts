import { Module } from '@nestjs/common';
import { TeamController } from './controllers/team.controller';
import { ApiKeyController } from './controllers/api-key.controller';
import { AppShareController, AppSharePublicController } from './controllers/app-share.controller';
import { TeamService } from './services/team.service';
import { ApiKeyService } from './services/api-key.service';
import { AppShareService } from './services/app-share.service';

@Module({
  controllers: [
    TeamController,
    ApiKeyController,
    AppShareController,
    AppSharePublicController,
  ],
  providers: [
    TeamService,
    ApiKeyService,
    AppShareService,
  ],
  exports: [
    TeamService,
    ApiKeyService,
    AppShareService,
  ],
})
export class TeamModule {}
