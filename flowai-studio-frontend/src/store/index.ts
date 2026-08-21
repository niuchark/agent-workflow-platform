/**
 * Zustand 全局状态仓库：聚合各业务切片并持久化到 localStorage。
 *
 * 通过 useStore 的 selector 按需读取状态（如 useStore(s => s.apps)），
 * 各功能域的状态与 actions 分别定义在 slices/ 下的切片文件中，
 * 这里只负责把它们合并成一个 store，并持久化用户/登录等关键信息。
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createUserSlice } from './slices/userSlice'
import { AppSlice, createAppSlice } from './slices/appSlice'
import { WorkflowSlice, createWorkflowSlice } from './slices/workflowSlice'
import { GlobalSlice, createGlobalSlice } from './slices/globalSlice'
import { RAGSlice, createRAGSlice } from './slices/ragSlice'
import { SkillSlice, createSkillSlice } from './slices/skillSlice'
import { TemplateSlice, createTemplateSlice } from './slices/templateSlice'
import { TeamSlice, createTeamSlice } from './slices/teamSlice'
import { ApiKeySlice, createApiKeySlice } from './slices/apiKeySlice'

/** 全局 store 的完整类型：所有业务切片状态的交叉类型 */
type StoreState = ReturnType<typeof createUserSlice> &
  ReturnType<typeof createAppSlice> &
  ReturnType<typeof createWorkflowSlice> &
  ReturnType<typeof createGlobalSlice> &
  ReturnType<typeof createRAGSlice> &
  ReturnType<typeof createSkillSlice> &
  ReturnType<typeof createTemplateSlice> &
  ReturnType<typeof createTeamSlice> &
  ReturnType<typeof createApiKeySlice>

/** 创建全局 store：合并所有切片，并持久化用户会话与全局配置 */
export const useStore = create<StoreState>()(
  persist(
    (...args) => ({
      // 将每个切片的状态与 actions 合并进同一个 store
      ...createUserSlice(...args),
      ...createAppSlice(...args),
      ...createWorkflowSlice(...args),
      ...createGlobalSlice(...args),
      ...createRAGSlice(...args),
      ...createSkillSlice(...args),
      ...createTemplateSlice(...args),
      ...createTeamSlice(...args),
      ...createApiKeySlice(...args),
    }),
    {
      // 持久化配置：登录态由 authStorage 单独管理，
      // 这里只持久化非敏感的全局配置，避免 token 重复落盘
      name: 'flowai-storage',
      partialize: (state) => ({
        globalConfig: state.globalConfig,
      }),
      // 兼容旧版本：忽略 persisted 中遗留的登录态字段，登录态一律以 authStorage 为准
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<StoreState>
        return {
          ...currentState,
          ...persisted,
          user: currentState.user,
          token: currentState.token,
          isAuthenticated: currentState.isAuthenticated,
        }
      },
    }
  )
)

export * from './slices/userSlice'
export * from './slices/appSlice'
export * from './slices/workflowSlice'
export * from './slices/globalSlice'
export * from './slices/ragSlice'
export * from './slices/skillSlice'
export * from './slices/templateSlice'
export * from './slices/teamSlice'
export * from './slices/apiKeySlice'
