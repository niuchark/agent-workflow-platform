import { StateCreator } from 'zustand'
import { ApiKey, CreateApiKeyForm, ApiKeyCreatedResponse } from '../../types'
import * as teamApi from '../../utils/teamApi'

export interface ApiKeySlice {
  apiKeys: ApiKey[]
  createdKey: ApiKeyCreatedResponse | null
  isLoading: boolean

  setApiKeys: (keys: ApiKey[]) => void
  setCreatedKey: (key: ApiKeyCreatedResponse | null) => void
  fetchApiKeys: (applicationId?: string) => Promise<ApiKey[]>
  createApiKey: (data: CreateApiKeyForm) => Promise<ApiKeyCreatedResponse>
  deleteApiKey: (keyId: string) => Promise<void>
  toggleApiKey: (keyId: string, isActive: boolean) => Promise<ApiKey>
}

export const createApiKeySlice: StateCreator<ApiKeySlice> = (set, get) => ({
  apiKeys: [],
  createdKey: null,
  isLoading: false,

  setApiKeys: (apiKeys) => set({ apiKeys }),
  setCreatedKey: (createdKey) => set({ createdKey }),

  fetchApiKeys: async (applicationId) => {
    set({ isLoading: true })
    try {
      const response = await teamApi.fetchApiKeys(applicationId) as any
      const apiKeys = (Array.isArray(response.data) ? response.data : []) as ApiKey[]
      set({ apiKeys, isLoading: false })
      return apiKeys
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  createApiKey: async (data) => {
    set({ isLoading: true })
    try {
      const response = await teamApi.createApiKey(data) as any
      const createdKey = response.data as ApiKeyCreatedResponse
      const currentKeys = Array.isArray(get().apiKeys) ? get().apiKeys : []
      // 创建后重新获取列表（因为完整 key 只返回一次）
      set({ createdKey, isLoading: false })
      return createdKey
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  deleteApiKey: async (keyId) => {
    try {
      await teamApi.deleteApiKey(keyId)
      set({ apiKeys: get().apiKeys.filter((k) => k.id !== keyId) })
    } catch (error) {
      throw error
    }
  },

  toggleApiKey: async (keyId, isActive) => {
    try {
      const response = await teamApi.toggleApiKey(keyId, isActive) as any
      const updatedKey = response.data as ApiKey
      set({
        apiKeys: get().apiKeys.map((k) =>
          k.id === keyId ? updatedKey : k
        ),
      })
      return updatedKey
    } catch (error) {
      throw error
    }
  },
})
