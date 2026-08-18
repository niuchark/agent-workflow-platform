import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ApiKeyService } from '../../modules/team/services/api-key.service';

/**
 * API Key 认证守卫
 *
 * 用于外部 API 调用场景（如嵌入的应用、第三方集成）
 * 从 Authorization header 提取 Bearer sk-xxx 格式的 API Key
 * 验证通过后设置 request.apiKeyUser = { userId, applicationId, scopes }
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(private readonly apiKeyService: ApiKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('缺少 Authorization header');
    }

    const token = authHeader.substring(7).trim();

    // 检查是否是 API Key 格式 (sk-xxx)
    if (!token.startsWith('sk-')) {
      throw new UnauthorizedException('无效的 API Key 格式');
    }

    const keyInfo = await this.apiKeyService.validateApiKey(token);

    if (!keyInfo) {
      throw new UnauthorizedException('API Key 无效或已过期');
    }

    // 将 API Key 信息附加到请求对象
    request.apiKeyUser = keyInfo;
    request.user = { userId: keyInfo.userId }; // 兼容 @CurrentUser 装饰器

    this.logger.debug(`API Key authenticated: userId=${keyInfo.userId}, scopes=${keyInfo.scopes.join(',')}`);

    return true;
  }
}
