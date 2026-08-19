export const USER_MODEL_PROVIDERS = ['qwen', 'openai', 'ollama'] as const;

export type UserModelProvider = (typeof USER_MODEL_PROVIDERS)[number];
export type CredentialStatus = 'untested' | 'valid' | 'invalid' | 'disabled';

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

export interface ModelSelection {
  provider: UserModelProvider;
  model: string;
}

export interface ResolvedModelCredential {
  provider: UserModelProvider;
  baseUrl: string;
  apiKey?: string;
}

export const DEFAULT_PROVIDER_BASE_URLS: Record<UserModelProvider, string> = {
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  openai: 'https://api.openai.com/v1',
  ollama: 'http://ollama:11434',
};

export function isUserModelProvider(value: string): value is UserModelProvider {
  return USER_MODEL_PROVIDERS.includes(value as UserModelProvider);
}
