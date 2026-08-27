/**
 * 技能（Skill）状态切片：管理技能列表、创建/更新/删除与执行。
 *
 * 同时支持内置技能（builtin）的拉取，内置技能由后端定义，
 * 前端只做展示与启用/停用配置。
 */
import { StateCreator } from 'zustand'
import { Skill } from '../../types'
import request from '../../utils/axios'

/** 技能切片对外暴露的状态与 Actions 类型 */
export interface SkillSlice {
  skills: Skill[]
  skillLoading: boolean
  skillError: string | null
  
  // Actions
  setSkills: (skills: Skill[]) => void
  setSkillLoading: (loading: boolean) => void
  setSkillError: (error: string | null) => void
  fetchSkills: () => Promise<void>
  createSkill: (data: { name: string; description?: string; type: string; builtinType?: string; isActive?: boolean; config?: Record<string, any> }) => Promise<Skill>
  updateSkill: (id: string, data: { name?: string; description?: string; type?: string; builtinType?: string; isActive?: boolean; config?: Record<string, any> }) => Promise<Skill>
  deleteSkill: (id: string) => Promise<void>
  executeSkill: (skillId: string, params: Record<string, any>) => Promise<any>
  getBuiltinSkills: () => Promise<any[]>
}

/** 创建技能切片：提供技能的增删改查与执行操作 */
export const createSkillSlice: StateCreator<SkillSlice> = (set, get) => ({
  skills: [],
  skillLoading: false,
  skillError: null,

  setSkills: (skills) => set({ skills }),
  
  setSkillLoading: (skillLoading) => set({ skillLoading }),
  
  setSkillError: (skillError) => set({ skillError }),

  /** 拉取技能列表 */
  fetchSkills: async () => {
    set({ skillLoading: true, skillError: null })
    try {
      const response = await request.get('/skill') as any
      const skills = (Array.isArray(response.data) ? response.data : [])
      set({ skills, skillLoading: false })
    } catch (error) {
      set({ skillError: 'Failed to fetch skills', skillLoading: false, skills: [] })
      throw error
    }
  },

  /** 创建技能：成功后追加到列表末尾 */
  createSkill: async (data) => {
    set({ skillLoading: true, skillError: null })
    try {
      const response = await request.post('/skill', data) as any
      const skill = response.data
      const currentSkills = Array.isArray(get().skills) ? get().skills : []
      set({ 
        skills: [...currentSkills, skill],
        skillLoading: false
      })
      return skill
    } catch (error) {
      set({ skillError: 'Failed to create skill', skillLoading: false })
      throw error
    }
  },

  /** 更新技能：用最新结果替换列表中的对应项 */
  updateSkill: async (id, data) => {
    set({ skillLoading: true, skillError: null })
    try {
      const response = await request.put(`/skill/${id}`, data) as any
      const updatedSkill = response.data
      const currentSkills = Array.isArray(get().skills) ? get().skills : []
      set({
        skills: currentSkills.map(skill => skill.id === id ? updatedSkill : skill),
        skillLoading: false,
      })
      return updatedSkill
    } catch (error) {
      set({ skillError: 'Failed to update skill', skillLoading: false })
      throw error
    }
  },

  /** 删除技能：从列表中移除 */
  deleteSkill: async (id) => {
    set({ skillLoading: true, skillError: null })
    try {
      await request.delete(`/skill/${id}`)
      const currentSkills = Array.isArray(get().skills) ? get().skills : []
      set({
        skills: currentSkills.filter(skill => skill.id !== id),
        skillLoading: false,
      })
    } catch (error) {
      set({ skillError: 'Failed to delete skill', skillLoading: false })
      throw error
    }
  },

  /** 执行技能：传入参数并返回执行结果 */
  executeSkill: async (skillId, params) => {
    set({ skillLoading: true, skillError: null })
    try {
      const response = await request.post(`/skill/${skillId}/execute`, { params }) as any
      set({ skillLoading: false })
      return response.data
    } catch (error) {
      set({ skillError: 'Failed to execute skill', skillLoading: false })
      throw error
    }
  },

  /** 拉取后端内置技能列表 */
  getBuiltinSkills: async () => {
    set({ skillLoading: true, skillError: null })
    try {
      const response = await request.get('/skill/builtin/list') as any
      set({ skillLoading: false })
      return response.data || []
    } catch (error) {
      set({ skillError: 'Failed to fetch builtin skills', skillLoading: false })
      throw error
    }
  },
})
