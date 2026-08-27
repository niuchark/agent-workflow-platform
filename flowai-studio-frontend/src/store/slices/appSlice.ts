/**
 * 应用状态切片：管理应用（App）列表、当前打开的应用及其生命周期。
 *
 * 生命周期操作（发布/取消发布/归档/取消归档）会复用
 * updateAppLifecycle，用服务端返回的最新字段原地更新列表与当前应用。
 */
import { StateCreator } from 'zustand'
import { Application, CreateAppForm } from '../../types'
import request, { getResponseData } from '../../utils/axios'

/** 应用切片对外暴露的状态与 Actions 类型 */
export interface AppSlice {
  apps: Application[]
  currentApp: Application | null
  appLoading: boolean
  
  // Actions
  setApps: (apps: Application[]) => void
  setCurrentApp: (app: Application | null) => void
  fetchApps: () => Promise<Application[]>
  fetchAppById: (id: string) => Promise<Application>
  createApp: (data: CreateAppForm) => Promise<Application>
  updateApp: (id: string, data: Partial<CreateAppForm>) => Promise<Application>
  deleteApp: (id: string) => Promise<void>
  publishApp: (id: string) => Promise<void>
  unpublishApp: (id: string) => Promise<void>
  archiveApp: (id: string) => Promise<void>
  unarchiveApp: (id: string) => Promise<void>
}

/** 创建应用切片：提供列表加载、详情、增删改与生命周期操作 */
export const createAppSlice: StateCreator<AppSlice> = (set, get) => {
  /**
   * 应用生命周期通用处理：调用对应 PATCH 接口后，
   * 用返回的部分字段同步更新列表与当前应用，避免整页刷新。
   */
  const updateAppLifecycle = async (
    id: string,
    action: 'publish' | 'unpublish' | 'archive' | 'unarchive',
  ) => {
    set({ appLoading: true })
    try {
      const partial = getResponseData<Partial<Application>>(
        await request.patch(`/apps/${id}/${action}`),
      ) || {}
      const currentApps = Array.isArray(get().apps) ? get().apps : []
      set({
        apps: currentApps.map((app) => app.id === id ? { ...app, ...partial } : app),
        currentApp: get().currentApp?.id === id ? { ...get().currentApp!, ...partial } : get().currentApp,
      })
    } finally {
      set({ appLoading: false })
    }
  }

  return {
    apps: [],
    currentApp: null,
    appLoading: false,

    /** 整体替换应用列表 */
    setApps: (apps) => set({ apps }),
  
    /** 设置当前打开的应用 */
    setCurrentApp: (app) => set({ currentApp: app }),

    /** 拉取应用列表；失败时清空列表并继续抛错 */
    fetchApps: async () => {
      set({ appLoading: true })
      try {
        const data = getResponseData<Application[]>(await request.get('/apps'))
        const apps = Array.isArray(data) ? data : []
        set({ apps, appLoading: false })
        return apps
      } catch (error) {
        set({ apps: [], appLoading: false })
        throw error
      }
    },

    /** 按 ID 拉取应用详情并设为当前应用 */
    fetchAppById: async (id) => {
      set({ appLoading: true })
      try {
        const app = getResponseData<Application>(await request.get(`/apps/${id}`))
        set({ currentApp: app, appLoading: false })
        return app
      } catch (error) {
        set({ appLoading: false })
        throw error
      }
    },

    /** 创建应用：成功后追加到列表末尾 */
    createApp: async (data) => {
      set({ appLoading: true })
      try {
        const app = getResponseData<Application>(await request.post('/apps', data))
        const currentApps = Array.isArray(get().apps) ? get().apps : []
        set({ apps: [...currentApps, app], appLoading: false })
        return app
      } catch (error) {
        set({ appLoading: false })
        throw error
      }
    },

    /** 更新应用：同步更新列表与当前应用 */
    updateApp: async (id, data) => {
      set({ appLoading: true })
      try {
        const updatedApp = getResponseData<Application>(await request.patch(`/apps/${id}`, data))
        const currentApps = Array.isArray(get().apps) ? get().apps : []

        set({
          apps: currentApps.map((app) => app.id === id ? updatedApp : app),
          currentApp: get().currentApp?.id === id ? updatedApp : get().currentApp,
          appLoading: false,
        })

        return updatedApp
      } catch (error) {
        set({ appLoading: false })
        throw error
      }
    },

    /** 删除应用：从列表移除，若删除的是当前应用则清空 */
    deleteApp: async (id) => {
      set({ appLoading: true })
      try {
        await request.delete(`/apps/${id}`)
        const currentApps = Array.isArray(get().apps) ? get().apps : []
        set({
          apps: currentApps.filter((app) => app.id !== id),
          currentApp: get().currentApp?.id === id ? null : get().currentApp,
          appLoading: false,
        })
      } catch (error) {
        set({ appLoading: false })
        throw error
      }
    },

    /** 发布应用 */
    publishApp: (id) => updateAppLifecycle(id, 'publish'),

    /** 取消发布应用 */
    unpublishApp: (id) => updateAppLifecycle(id, 'unpublish'),

    /** 归档应用 */
    archiveApp: (id) => updateAppLifecycle(id, 'archive'),

    /** 取消归档应用 */
    unarchiveApp: (id) => updateAppLifecycle(id, 'unarchive'),
  }
}
