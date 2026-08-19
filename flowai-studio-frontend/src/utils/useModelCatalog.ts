import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getModelCredentials,
  getProviderModels,
  ModelCredentialSummary,
  ProviderModel,
  UserModelProvider,
} from './modelCredentialApi'

export function useModelCatalog() {
  const [credentials, setCredentials] = useState<ModelCredentialSummary[]>([])
  const [models, setModels] = useState<ProviderModel[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const summaries = await getModelCredentials()
      setCredentials(summaries)
      const available = summaries.filter((item) => item.status === 'valid' && item.isEnabled)
      const results = await Promise.allSettled(available.map((item) => getProviderModels(item.provider)))
      setModels(results.flatMap((result) => result.status === 'fulfilled' ? result.value : []))
    } catch {
      setCredentials([])
      setModels([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const availableProviders = useMemo(
    () => credentials.filter((item) => item.status === 'valid' && item.isEnabled).map((item) => item.provider),
    [credentials],
  )

  const modelsByProvider = useMemo(() => {
    const grouped: Record<UserModelProvider, ProviderModel[]> = { qwen: [], openai: [], ollama: [] }
    for (const model of models) grouped[model.provider].push(model)
    return grouped
  }, [models])

  return { credentials, models, modelsByProvider, availableProviders, loading, refresh }
}

export function inferLegacyProvider(model?: string): UserModelProvider {
  const value = (model || '').toLowerCase()
  if (value.startsWith('gpt-') || value.startsWith('o1') || value.startsWith('o3')) return 'openai'
  if (value.startsWith('qwen') && !value.includes(':')) return 'qwen'
  if (value.includes(':')) return 'ollama'
  return 'qwen'
}
