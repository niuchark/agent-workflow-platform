/**
 * Base URL 安全校验服务：防止 SSRF 与私网访问。
 *
 * 校验规则：
 * - 仅允许 HTTP/HTTPS，且 URL 不能带认证信息/查询参数/片段；
 * - 公网必须 HTTPS，除非该 origin 已加入管理员私网白名单；
 * - 解析 DNS 后拒绝云元数据、链路本地与私网地址（白名单除外）。
 */
import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lookup } from 'dns/promises';
import { isIP } from 'net';

/** Base URL 安全校验服务 */
@Injectable()
export class BaseUrlSecurityService {
  private readonly privateAllowlist: Set<string>;

  constructor(private readonly configService: ConfigService) {
    const raw = this.configService.get<string>('MODEL_PRIVATE_BASE_URL_ALLOWLIST', '');
    this.privateAllowlist = new Set(
      raw.split(',').map((value) => value.trim()).filter(Boolean).map((value) => {
        try { return new URL(value).origin; } catch { return ''; }
      }).filter(Boolean),
    );
  }

  /** 校验并规范化 Base URL：非法地址直接拒绝 */
  async assertAllowed(rawUrl: string): Promise<string> {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      this.reject('MODEL_BASE_URL_INVALID', 'Base URL 格式无效');
    }

    if (!['http:', 'https:'].includes(url!.protocol)) {
      this.reject('MODEL_BASE_URL_FORBIDDEN', 'Base URL 仅支持 HTTP 或 HTTPS');
    }
    if (url!.username || url!.password || url!.hash || url!.search) {
      this.reject('MODEL_BASE_URL_FORBIDDEN', 'Base URL 不能包含认证信息、查询参数或片段');
    }

    const allowlisted = this.privateAllowlist.has(url!.origin);
    if (url!.protocol !== 'https:' && !allowlisted) {
      this.reject('MODEL_BASE_URL_FORBIDDEN', '公网模型服务必须使用 HTTPS');
    }

    const addresses = await this.resolve(url!.hostname);
    for (const address of addresses) {
      if (this.isMetadataOrLinkLocal(address)) {
        this.reject('MODEL_BASE_URL_FORBIDDEN', '禁止访问云元数据或链路本地地址');
      }
      if (this.isPrivate(address) && !allowlisted) {
        if (this.isProxyFakeIp(address) && this.isTrustedPublicProviderHost(url!.hostname)) {
          continue;
        }
        this.reject('MODEL_BASE_URL_FORBIDDEN', '私网模型地址未加入管理员白名单');
      }
    }

    const pathname = url!.pathname.replace(/\/+$/, '');
    return `${url!.origin}${pathname === '/' ? '' : pathname}`;
  }

  /** 解析主机名到 IP 列表（直接传 IP 时原样返回） */
  private async resolve(hostname: string): Promise<string[]> {
    const normalizedHostname = hostname.startsWith('[') && hostname.endsWith(']')
      ? hostname.slice(1, -1)
      : hostname;
    if (isIP(normalizedHostname)) return [normalizedHostname];
    try {
      const records = await lookup(normalizedHostname, { all: true, verbatim: true });
      if (records.length === 0) throw new Error('empty DNS result');
      return records.map((record) => record.address);
    } catch {
      this.reject('MODEL_BASE_URL_UNRESOLVED', '无法解析模型服务地址');
    }
  }

  /** 判断是否为私网/环回/保留地址 */
  private isPrivate(address: string): boolean {
    if (isIP(address) === 4) {
      const [a, b, c] = address.split('.').map(Number);
      return a === 10 || a === 127 || a === 0 ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 192 && b === 0 && c === 0) ||
        (a === 198 && (b === 18 || b === 19)) ||
        (a === 192 && b === 0 && c === 2) ||
        (a === 198 && b === 51 && c === 100) ||
        (a === 203 && b === 0 && c === 113) ||
        a >= 224;
    }
    const normalized = address.toLowerCase();
    if (normalized === '::1' || normalized === '::' || normalized.startsWith('fc') || normalized.startsWith('fd')) {
      return true;
    }
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    return mapped ? this.isPrivate(mapped) || this.isMetadataOrLinkLocal(mapped) : false;
  }

  private isMetadataOrLinkLocal(address: string): boolean {
    if (isIP(address) === 4) {
      const [a, b] = address.split('.').map(Number);
      return (a === 169 && b === 254) || address === '100.100.100.200';
    }
    return address.toLowerCase().startsWith('fe8') ||
      address.toLowerCase().startsWith('fe9') ||
      address.toLowerCase().startsWith('fea') ||
      address.toLowerCase().startsWith('feb');
  }

  private isProxyFakeIp(address: string): boolean {
    if (isIP(address) !== 4) return false;
    const [a, b] = address.split('.').map(Number);
    return a === 198 && (b === 18 || b === 19);
  }

  private isTrustedPublicProviderHost(hostname: string): boolean {
    const normalized = hostname.toLowerCase().replace(/\.$/, '');
    return normalized === 'dashscope.aliyuncs.com' ||
      normalized.endsWith('.maas.aliyuncs.com');
  }

  private reject(code: string, message: string): never {
    throw new UnprocessableEntityException({ code, message });
  }
}
