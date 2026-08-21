/** Base URL 安全校验服务单元测试 */
import { ConfigService } from '@nestjs/config';
import { lookup } from 'dns/promises';
import { BaseUrlSecurityService } from '../base-url-security.service';

jest.mock('dns/promises', () => ({ lookup: jest.fn() }));

describe('BaseUrlSecurityService', () => {
  const create = (allowlist = '') => new BaseUrlSecurityService({
    get: jest.fn((_key: string, fallback: string) => allowlist || fallback),
  } as unknown as ConfigService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('allows public HTTPS and normalizes trailing slashes', async () => {
    await expect(create().assertAllowed('https://8.8.8.8/v1///')).resolves.toBe('https://8.8.8.8/v1');
  });

  it.each([
    'http://8.8.8.8/v1',
    'file:///tmp/model',
    'https://user:pass@8.8.8.8/v1',
    'https://8.8.8.8/v1?token=secret',
    'https://127.0.0.1:11434',
    'https://10.0.0.2:11434',
    'https://192.168.1.10:11434',
    'https://[::1]:11434',
    'https://[fd00::1]:11434',
  ])('blocks unsafe base URL %s', async (url) => {
    await expect(create().assertAllowed(url)).rejects.toMatchObject({ status: 422 });
  });

  it('allows an exact private origin from the administrator allowlist', async () => {
    const service = create('http://127.0.0.1:11434,http://ollama:11434');
    await expect(service.assertAllowed('http://127.0.0.1:11434/api')).resolves.toBe('http://127.0.0.1:11434/api');
  });

  it('supports an exact allowlisted private IPv6 origin', async () => {
    const service = create('http://[::1]:11434');
    await expect(service.assertAllowed('http://[::1]:11434')).resolves.toBe('http://[::1]:11434');
  });

  it.each(['http://169.254.169.254', 'http://100.100.100.200'])
  ('always blocks metadata addresses even when allowlisted: %s', async (url) => {
    await expect(create(url).assertAllowed(url)).rejects.toMatchObject({ status: 422 });
  });

  it('does not allow a broader host or port than the exact origin', async () => {
    const service = create('http://127.0.0.1:11434');
    await expect(service.assertAllowed('http://127.0.0.1:11435')).rejects.toMatchObject({ status: 422 });
  });

  it('allows a trusted DashScope hostname resolved through a proxy fake IP', async () => {
    (lookup as jest.Mock).mockResolvedValue([{ address: '198.18.0.167', family: 4 }]);

    await expect(create().assertAllowed('https://dashscope.aliyuncs.com/compatible-mode/v1'))
      .resolves.toBe('https://dashscope.aliyuncs.com/compatible-mode/v1');
  });

  it('still blocks an arbitrary hostname resolved to a proxy fake IP', async () => {
    (lookup as jest.Mock).mockResolvedValue([{ address: '198.18.0.168', family: 4 }]);

    await expect(create().assertAllowed('https://attacker.example/v1'))
      .rejects.toMatchObject({ status: 422 });
  });

  it('re-resolves DNS and blocks a rebinding to a private address', async () => {
    const mockedLookup = lookup as jest.Mock;
    mockedLookup
      .mockResolvedValueOnce([{ address: '8.8.8.8', family: 4 }])
      .mockResolvedValueOnce([{ address: '127.0.0.1', family: 4 }]);
    const service = create();

    await expect(service.assertAllowed('https://models.example/v1')).resolves.toBe('https://models.example/v1');
    await expect(service.assertAllowed('https://models.example/v1')).rejects.toMatchObject({ status: 422 });
    expect(mockedLookup).toHaveBeenCalledTimes(2);
  });
});
