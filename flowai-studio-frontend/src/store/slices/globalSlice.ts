/**
 * 全局配置切片：管理主题、语言、侧边栏折叠、自动保存与全局提示消息。
 *
 * 这些是跨页面共享的轻量 UI 状态，其中 globalConfig 会被
 * store 持久化，刷新后保持用户偏好。
 */
import { StateCreator } from 'zustand'

/** 全局配置切片对外暴露的状态与 Actions 类型 */
export interface GlobalSlice {
  globalConfig: {
    theme: 'light' | 'dark'
    language: 'zh-CN' | 'en-US'
    sidebarCollapsed: boolean
    autoSave: boolean
  }
  loading: boolean
  debugIsLoading: boolean
  message: {
    type: 'success' | 'error' | 'warning' | 'info'
    content: string
    visible: boolean
  }
  
  // Actions
  setGlobalConfig: (config: Partial<GlobalSlice['globalConfig']>) => void
  setLoading: (loading: boolean) => void
  setDebugIsLoading: (loading: boolean) => void
  showMessage: (type: 'success' | 'error' | 'warning' | 'info', content: string) => void
  hideMessage: () => void
  toggleSidebar: () => void
}

/** 创建全局配置切片：提供配置更新、加载态、全局消息与侧边栏折叠等操作 */
export const createGlobalSlice: StateCreator<GlobalSlice> = (set, get) => ({
  globalConfig: {
    theme: 'light',
    language: 'zh-CN',
    sidebarCollapsed: false,
    autoSave: true,
  },
  loading: false,
  debugIsLoading: false,
  message: {
    type: 'info',
    content: '',
    visible: false,
  },

  /** 合并更新全局配置（只覆盖传入的字段） */
  setGlobalConfig: (config) => {
    set({
      globalConfig: {
        ...get().globalConfig,
        ...config,
      },
    })
  },
  
  setLoading: (loading) => set({ loading }),

  setDebugIsLoading: (debugIsLoading) => set({ debugIsLoading }),
  
  /** 显示全局提示消息，3 秒后自动隐藏 */
  showMessage: (type, content) => {
    set({
      message: {
        type,
        content,
        visible: true,
      },
    })
    
    // 3秒后自动隐藏
    setTimeout(() => {
      set({ message: { ...get().message, visible: false } })
    }, 3000)
  },
  
  hideMessage: () => set({ message: { ...get().message, visible: false } }),
  
  /** 切换侧边栏折叠状态 */
  toggleSidebar: () => {
    set({
      globalConfig: {
        ...get().globalConfig,
        sidebarCollapsed: !get().globalConfig.sidebarCollapsed,
      },
    })
  },
})
