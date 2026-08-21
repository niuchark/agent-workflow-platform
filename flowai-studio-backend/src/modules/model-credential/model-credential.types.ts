/**
 * 模型凭证类型：供应商、状态与凭证解析结果的定义。
 */
/** 当前支持的模型供应商 */
export const USER_MODEL_PROVIDERS = ['qwen', 'openai', 'ollama'] as const;

/** 模型供应商类型 */
export type UserModelProvider = (typeof USER_MODEL_PROVIDERS)[number];
/** 凭证状态：未测试 / 有效 / 无效 / 已停用 */
export type CredentialStatus = 'untested' | 'valid' | 'invalid' | 'disabled';

/** 凭证摘要（对外展示，不含完整密钥） */
export interface ModelCredentialSummary {
  provider: UserModelProvider;
  baseUrl: string;
  hasApiKey: boolean;
  apiKeyMasked?: string;
  status: CredentialStatus;
  isEnabled: boolean;
  lastTestedAt?: Date | string | null;
  lastTestMessage?: string | null;
}

/** 一次模型选择（供应商 + 模型） */
export interface ModelSelection {
  provider: UserModelProvider;
  model: string;
}

/** 解密后的凭证（仅内部使用，用完即弃） */
export interface ResolvedModelCredential {
  provider: UserModelProvider;
  baseUrl: string;
  apiKey?: string;
}

/** 各供应商的默认 Base URL */
export const DEFAULT_PROVIDER_BASE_URLS: Record<UserModelProvider, string> = {
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  openai: 'https://api.openai.com/v1',
  ollama: 'http://ollama:11434',
};

/** 类型守卫：判断字符串是否为合法供应商 */
export function isUserModelProvider(value: string): value is UserModelProvider {
  return USER_MODEL_PROVIDERS.includes(value as UserModelProvider);
}
