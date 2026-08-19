import request from './axios'

export type UserModelProvider = 'qwen' | 'openai' | 'ollama'
export type CredentialStatus = 'untested' | 'valid' | 'invalid' | 'disabled'

export interface ModelCredentialSummary {
  provider: UserModelProvider
  baseUrl: string
  hasApiKey: boolean
  apiKeyMasked?: string
  status: CredentialStatus
  isEnabled: boolean
  configured?: boolean
  lastTestedAt?: string
  lastTestMessage?: string
}

export interface ProviderModel {
  id: string
  displayName: string
  provider: UserModelProvider
}

const unwrap = <T>(response: any): T => response?.data ?? response

export async function getModelCredentials(): Promise<ModelCredentialSummary[]> {
  return unwrap(await request.get('/model-credentials', { cacheBust: true }))
}

export async function saveModelCredential(
  provider: UserModelProvider,
  data: { baseUrl: string; apiKey?: string; clearApiKey?: boolean },
): Promise<ModelCredentialSummary> {
  return unwrap(await request.put(`/model-credentials/${provider}`, data))
}

export async function testModelCredential(provider: UserModelProvider, model?: string): Promise<ModelCredentialSummary> {
  return unwrap(await request.post(`/model-credentials/${provider}/test`, { model }))
}

export async function setModelCredentialEnabled(provider: UserModelProvider, enabled: boolean): Promise<ModelCredentialSummary> {
  return unwrap(await request.patch(`/model-credentials/${provider}/status`, { enabled }))
}

export async function deleteModelCredential(provider: UserModelProvider): Promise<void> {
  await request.delete(`/model-credentials/${provider}`)
}

export async function getProviderModels(provider: UserModelProvider): Promise<ProviderModel[]> {
  return unwrap(await request.get(`/model-credentials/${provider}/models`, { cacheBust: true }))
}

