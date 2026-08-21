/**
 * 模型凭证模块（全局）：管理各供应商凭证的加密存储与校验。
 */
import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../common/modules/prisma.module';
import { BaseUrlSecurityService } from './base-url-security.service';
import { CredentialCryptoService } from './credential-crypto.service';
import { ModelCredentialController } from './model-credential.controller';
import { ModelCredentialService } from './model-credential.service';

/** 全局模型凭证模块 */
@Global()
@Module({
  imports: [PrismaModule],
  controllers: [ModelCredentialController],
  providers: [CredentialCryptoService, BaseUrlSecurityService, ModelCredentialService],
  exports: [ModelCredentialService, BaseUrlSecurityService],
})
export class ModelCredentialModule {}
