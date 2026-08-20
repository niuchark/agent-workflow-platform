import { StateCreator } from 'zustand'
import { Application, CreateAppForm } from '../../types'
import request, { getResponseData } from '../../utils/axios'

export interface AppSlice {
  apps: Application[]
  currentApp: Application | null
  isLoading: boolean
  
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

export const createAppSlice: StateCreator<AppSlice> = (set, get) => {
  const updateAppLifecycle = async (
    id: string,
    action: 'publish' | 'unpublish' | 'archive' | 'unarchive',
  ) => {
    set({ isLoading: true })
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
      set({ isLoading: false })
    }
  }

  return {
    apps: [],
    currentApp: null,
    isLoading: false,

    setApps: (apps) => set({ apps }),
  
    setCurrentApp: (app) => set({ currentApp: app }),

    fetchApps: async () => {
      set({ isLoading: true })
      try {
        const data = getResponseData<Application[]>(await request.get('/apps'))
        const apps = Array.isArray(data) ? data : []
        set({ apps, isLoading: false })
        return apps
      } catch (error) {
        set({ apps: [], isLoading: false })
        throw error
      }
    },

    fetchAppById: async (id) => {
      set({ isLoading: true })
      try {
        const app = getResponseData<Application>(await request.get(`/apps/${id}`))
        set({ currentApp: app, isLoading: false })
        return app
      } catch (error) {
        set({ isLoading: false })
        throw error
      }
    },

    createApp: async (data) => {
      set({ isLoading: true })
      try {
        const app = getResponseData<Application>(await request.post('/apps', data))
        const currentApps = Array.isArray(get().apps) ? get().apps : []
        set({ apps: [...currentApps, app], isLoading: false })
        return app
      } catch (error) {
        set({ isLoading: false })
        throw error
      }
    },

    updateApp: async (id, data) => {
      set({ isLoading: true })
      try {
        const updatedApp = getResponseData<Application>(await request.patch(`/apps/${id}`, data))
        const currentApps = Array.isArray(get().apps) ? get().apps : []

        set({
          apps: currentApps.map((app) => app.id === id ? updatedApp : app),
          currentApp: get().currentApp?.id === id ? updatedApp : get().currentApp,
          isLoading: false,
        })

        return updatedApp
      } catch (error) {
        set({ isLoading: false })
        throw error
      }
    },

    deleteApp: async (id) => {
      set({ isLoading: true })
      try {
        await request.delete(`/apps/${id}`)
        const currentApps = Array.isArray(get().apps) ? get().apps : []
        set({
          apps: currentApps.filter((app) => app.id !== id),
          currentApp: get().currentApp?.id === id ? null : get().currentApp,
          isLoading: false,
        })
      } catch (error) {
        set({ isLoading: false })
        throw error
      }
    },

    publishApp: (id) => updateAppLifecycle(id, 'publish'),

    unpublishApp: (id) => updateAppLifecycle(id, 'unpublish'),

    archiveApp: (id) => updateAppLifecycle(id, 'archive'),

    unarchiveApp: (id) => updateAppLifecycle(id, 'unarchive'),
  }
}
