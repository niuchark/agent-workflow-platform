/**
 * 模型目录 Hook：加载各模型供应商的凭证与可用模型列表。
 *
 * 只把状态为 valid 且已启用的供应商纳入可用范围；
 * 单个供应商模型拉取失败不会阻断整体，而是降级为跳过并给出警告。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getModelCredentials,
  getProviderModels,
  ModelCredentialSummary,
  ProviderModel,
  UserModelProvider,
} from './modelCredentialApi'

/** 模型目录 Hook：返回凭证、模型分组、可用供应商与刷新方法 */
export function useModelCatalog() {
  const [credentials, setCredentials] = useState<ModelCredentialSummary[]>([])
  const [models, setModels] = useState<ProviderModel[]>([])
  const [loading, setLoading] = useState(true)

  /** 刷新模型目录：并发拉取各已启用供应商的模型列表 */
  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const summaries = await getModelCredentials()
      setCredentials(summaries)
      const available = summaries.filter((item) => item.status === 'valid' && item.isEnabled)
      const results = await Promise.allSettled(available.map((item) => getProviderModels(item.provider)))
      const failures = available.flatMap((item, index) => {
        const result = results[index]
        if (result?.status !== 'rejected') return []
        const reason = result.reason as { message?: string; response?: { status?: number } }
        return [`${item.provider}（${reason.response?.status || reason.message || '未知错误'}）`]
      })
      if (failures.length > 0) {
        console.warn(`模型目录加载失败：${failures.join('、')}`)
      }
      setModels(results.flatMap((result) => result.status === 'fulfilled' ? result.value : []))
    } catch {
      setCredentials([])
      setModels([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  /** 当前可用的供应商列表（凭证有效且已启用） */
  const availableProviders = useMemo(
    () => credentials.filter((item) => item.status === 'valid' && item.isEnabled).map((item) => item.provider),
    [credentials],
  )

  /** 按供应商分组的模型列表 */
  const modelsByProvider = useMemo(() => {
    const grouped: Record<UserModelProvider, ProviderModel[]> = { qwen: [], openai: [], ollama: [] }
    for (const model of models) grouped[model.provider].push(model)
    return grouped
  }, [models])

  return { credentials, models, modelsByProvider, availableProviders, loading, refresh }
}

/** 根据旧版模型字符串推断其所属供应商（用于兼容历史配置） */
export function inferLegacyProvider(model?: string): UserModelProvider {
  const value = (model || '').toLowerCase()
  if (value.startsWith('gpt-') || value.startsWith('o1') || value.startsWith('o3')) return 'openai'
  if (value.startsWith('qwen') && !value.includes(':')) return 'qwen'
  if (value.includes(':')) return 'ollama'
  return 'qwen'
}
