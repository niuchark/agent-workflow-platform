/**
 * 模型凭证 API：管理各供应商（Qwen/OpenAI/Ollama）的密钥与可用模型。
 *
 * 凭证支持测试连通性、启用/停用、删除；getProviderModels
 * 会向对应供应商实时拉取模型清单。
 */
import request from './axios'

/** 模型供应商类型：当前支持的三种来源 */
export type UserModelProvider = 'qwen' | 'openai' | 'ollama'
/** 凭证状态：未测试/有效/无效/已停用 */
export type CredentialStatus = 'untested' | 'valid' | 'invalid' | 'disabled'

/** 模型凭证摘要：展示密钥是否已配置、连通性状态与启停标记 */
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

/** 供应商返回的可用模型项 */
export interface ProviderModel {
  id: string
  displayName: string
  provider: UserModelProvider
}

/** 兼容响应拦截器已解包的情况，统一取出 data */
const unwrap = <T>(response: any): T => response?.data ?? response

/** 获取所有供应商的凭证摘要 */
export async function getModelCredentials(): Promise<ModelCredentialSummary[]> {
  return unwrap(await request.get('/model-credentials', { cacheBust: true }))
}

/** 保存供应商凭证（baseUrl/apiKey，支持清空密钥） */
export async function saveModelCredential(
  provider: UserModelProvider,
  data: { baseUrl: string; apiKey?: string; clearApiKey?: boolean },
): Promise<ModelCredentialSummary> {
  return unwrap(await request.put(`/model-credentials/${provider}`, data))
}

/** 测试指定供应商的连通性（可指定测试模型） */
export async function testModelCredential(provider: UserModelProvider, model?: string): Promise<ModelCredentialSummary> {
  return unwrap(await request.post(`/model-credentials/${provider}/test`, { model }))
}

/** 启用/停用供应商凭证 */
export async function setModelCredentialEnabled(provider: UserModelProvider, enabled: boolean): Promise<ModelCredentialSummary> {
  return unwrap(await request.patch(`/model-credentials/${provider}/status`, { enabled }))
}

/** 删除供应商凭证 */
export async function deleteModelCredential(provider: UserModelProvider): Promise<void> {
  await request.delete(`/model-credentials/${provider}`)
}

/** 拉取指定供应商的可用模型清单 */
export async function getProviderModels(provider: UserModelProvider): Promise<ProviderModel[]> {
  return unwrap(await request.get(`/model-credentials/${provider}/models`, { cacheBust: true }))
}
