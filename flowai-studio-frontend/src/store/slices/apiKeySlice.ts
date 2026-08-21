/**
 * API Key 状态切片：管理应用 API Key 的列表、创建、删除与启停。
 *
 * 注意：创建成功时服务端只返回一次完整 key，因此 createdKey
 * 只保存本次创建结果，列表页需在创建后提示用户立即保存。
 */
import { StateCreator } from 'zustand'
import { ApiKey, CreateApiKeyForm, ApiKeyCreatedResponse } from '../../types'
import * as teamApi from '../../utils/teamApi'

/** API Key 切片对外暴露的状态与 Actions 类型 */
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

/** 创建 API Key 切片：封装列表加载、创建、删除与启停操作 */
export const createApiKeySlice: StateCreator<ApiKeySlice> = (set, get) => ({
  apiKeys: [],
  createdKey: null,
  isLoading: false,

  setApiKeys: (apiKeys) => set({ apiKeys }),
  setCreatedKey: (createdKey) => set({ createdKey }),

  /** 拉取 API Key 列表（可按应用过滤） */
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

  /** 创建 API Key：保存本次返回的完整 key（仅此一次），供页面提示用户 */
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

  /** 删除 API Key：成功后从本地列表中移除 */
  deleteApiKey: async (keyId) => {
    try {
      await teamApi.deleteApiKey(keyId)
      set({ apiKeys: get().apiKeys.filter((k) => k.id !== keyId) })
    } catch (error) {
      throw error
    }
  },

  /** 启用/停用 API Key：用服务端返回的最新状态更新列表 */
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
