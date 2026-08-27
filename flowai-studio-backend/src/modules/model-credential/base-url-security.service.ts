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
import ipaddr = require('ipaddr.js');

/** Base URL 安全校验服务 */
@Injectable()
export class BaseUrlSecurityService {
  private readonly modelPrivateAllowlist: Set<string>;
  private readonly outboundPrivateAllowlist: Set<string>;

  constructor(private readonly configService: ConfigService) {
    this.modelPrivateAllowlist = this.parseAllowlist(
      this.configService.get<string>('MODEL_PRIVATE_BASE_URL_ALLOWLIST', ''),
    );
    this.outboundPrivateAllowlist = this.parseAllowlist(
      this.configService.get<string>('OUTBOUND_PRIVATE_URL_ALLOWLIST', ''),
    );
  }

  /** 校验并规范化 Base URL：非法地址直接拒绝 */
  async assertAllowed(rawUrl: string): Promise<string> {
    const url = await this.assertUrlAllowed(rawUrl, {
      allowQuery: false,
      codePrefix: 'MODEL_BASE_URL',
      label: 'Base URL',
      privateAllowlist: this.modelPrivateAllowlist,
    });
    const pathname = url.pathname.replace(/\/+$/, '');
    return `${url.origin}${pathname === '/' ? '' : pathname}`;
  }

  /**
   * 校验一次完整的出站 HTTP 请求 URL。
   *
   * 与模型 Base URL 不同，请求 URL 可以包含查询参数；认证信息、片段、
   * 云元数据地址和未授权私网仍会被拒绝。调用方还应关闭自动重定向，
   * 避免公开地址通过 30x 跳转到内网。
   */
  async assertRequestUrlAllowed(rawUrl: string): Promise<string> {
    const url = await this.assertUrlAllowed(rawUrl, {
      allowQuery: true,
      codePrefix: 'OUTBOUND_URL',
      label: '请求 URL',
      privateAllowlist: this.outboundPrivateAllowlist,
    });
    return url.toString();
  }

  /** 解析、校验协议和 DNS 解析结果，供 Base URL 与完整请求 URL 复用 */
  private async assertUrlAllowed(
    rawUrl: string,
    options: {
      allowQuery: boolean;
      codePrefix: string;
      label: string;
      privateAllowlist: Set<string>;
    },
  ): Promise<URL> {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      this.reject(`${options.codePrefix}_INVALID`, `${options.label} 格式无效`);
    }

    if (!['http:', 'https:'].includes(url!.protocol)) {
      this.reject(`${options.codePrefix}_FORBIDDEN`, `${options.label} 仅支持 HTTP 或 HTTPS`);
    }
    if (url!.username || url!.password || url!.hash || (!options.allowQuery && url!.search)) {
      const suffix = options.allowQuery ? '认证信息或片段' : '认证信息、查询参数或片段';
      this.reject(`${options.codePrefix}_FORBIDDEN`, `${options.label} 不能包含${suffix}`);
    }

    const allowlisted = options.privateAllowlist.has(url!.origin);
    if (url!.protocol !== 'https:' && !allowlisted) {
      this.reject(`${options.codePrefix}_FORBIDDEN`, `公网${options.label}必须使用 HTTPS`);
    }

    const addresses = await this.resolve(url!.hostname, options.codePrefix);
    for (const address of addresses) {
      if (this.isMetadataOrLinkLocal(address)) {
        this.reject(`${options.codePrefix}_FORBIDDEN`, '禁止访问云元数据或链路本地地址');
      }
      if (this.isPrivate(address) && !allowlisted) {
        if (this.isProxyFakeIp(address) && this.isTrustedPublicProviderHost(url!.hostname)) {
          continue;
        }
        this.reject(`${options.codePrefix}_FORBIDDEN`, '私网地址未加入管理员白名单');
      }
    }
    return url!;
  }

  /** 解析主机名到 IP 列表（直接传 IP 时原样返回） */
  private async resolve(hostname: string, codePrefix: string): Promise<string[]> {
    const normalizedHostname = hostname.startsWith('[') && hostname.endsWith(']')
      ? hostname.slice(1, -1)
      : hostname;
    if (isIP(normalizedHostname)) return [normalizedHostname];
    try {
      const records = await lookup(normalizedHostname, { all: true, verbatim: true });
      if (records.length === 0) throw new Error('empty DNS result');
      return records.map((record) => record.address);
    } catch {
      this.reject(`${codePrefix}_UNRESOLVED`, '无法解析服务地址');
    }
  }

  private parseAllowlist(raw: string): Set<string> {
    return new Set(
      raw
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => {
          try {
            return new URL(value).origin;
          } catch {
            return '';
          }
        })
        .filter(Boolean),
    );
  }

  /** 判断是否为私网/环回/保留地址 */
  private isPrivate(address: string): boolean {
    const mappedIpv4 = this.mappedIpv4(address);
    if (mappedIpv4) return this.isPrivate(mappedIpv4);

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
    return false;
  }

  private isMetadataOrLinkLocal(address: string): boolean {
    const mappedIpv4 = this.mappedIpv4(address);
    if (mappedIpv4) return this.isMetadataOrLinkLocal(mappedIpv4);

    if (isIP(address) === 4) {
      const [a, b] = address.split('.').map(Number);
      return (a === 169 && b === 254) || address === '100.100.100.200';
    }
    return address.toLowerCase().startsWith('fe8') ||
      address.toLowerCase().startsWith('fe9') ||
      address.toLowerCase().startsWith('fea') ||
      address.toLowerCase().startsWith('feb');
  }

  private mappedIpv4(address: string): string | null {
    try {
      const parsed = ipaddr.parse(address);
      return parsed instanceof ipaddr.IPv6 && parsed.isIPv4MappedAddress()
        ? parsed.toIPv4Address().toString()
        : null;
    } catch {
      return null;
    }
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
