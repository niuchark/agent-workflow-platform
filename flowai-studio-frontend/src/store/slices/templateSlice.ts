/**
 * 工作流模板状态切片：管理模板市场的列表、分类、评分与导入。
 *
 * 列表查询支持关键词、分类、标签、官方筛选、排序与分页，
 * 分页信息（总数/页码/总页数）一并保存在 store 中供页面展示。
 */
import { StateCreator } from 'zustand'
import { WorkflowTemplate, TemplateCategoryCount, TemplateSort, TemplateCategory } from '../../types'
import request, { getResponseData } from '../../utils/axios'

/** 模板接口的基础路径 */
const TEMPLATE_API = '/templates'

/** 模板切片对外暴露的状态与 Actions 类型 */
export interface TemplateSlice {
  templates: WorkflowTemplate[]
  templateTotal: number
  templatePage: number
  templatePageSize: number
  templateTotalPages: number
  templateCategories: TemplateCategoryCount[]
  templateLoading: boolean
  templateError: string | null

  // Actions
  fetchTemplates: (params?: {
    keyword?: string
    category?: TemplateCategory
    tag?: string
    isOfficial?: boolean
    sort?: TemplateSort
    page?: number
    pageSize?: number
  }) => Promise<void>
  fetchTemplateCategories: () => Promise<void>
  fetchTemplateById: (id: string) => Promise<WorkflowTemplate>
  createTemplate: (data: {
    name: string
    description?: string
    icon?: string
    screenshot?: string
    category: TemplateCategory
    tags?: string[]
    isOfficial?: boolean
    sourceWorkflowId?: string
  }) => Promise<WorkflowTemplate>
  updateTemplate: (id: string, data: {
    name?: string
    description?: string
    icon?: string
    screenshot?: string
    category?: TemplateCategory
    tags?: string[]
  }) => Promise<WorkflowTemplate>
  publishTemplate: (id: string) => Promise<WorkflowTemplate>
  archiveTemplate: (id: string) => Promise<WorkflowTemplate>
  createFromTemplate: (id: string, data: { applicationId: string; name?: string }) => Promise<{
    workflowId: string
    name: string
    templateName: string
    templateId: string
  }>
  rateTemplate: (id: string, rating: number) => Promise<{
    rating: number
    ratingCount: number
    yourRating: number
  }>
  deleteTemplate: (id: string) => Promise<void>
}

/** 创建模板切片：提供模板列表、分类、详情、CRUD、发布/归档、导入与评分操作 */
export const createTemplateSlice: StateCreator<TemplateSlice> = (set) => ({
  templates: [],
  templateTotal: 0,
  templatePage: 1,
  templatePageSize: 20,
  templateTotalPages: 0,
  templateCategories: [],
  templateLoading: false,
  templateError: null,

  /** 分页查询模板列表，并保存分页元信息 */
  fetchTemplates: async (params = {}) => {
    set({ templateLoading: true, templateError: null })
    try {
      const data = getResponseData<{
        items: WorkflowTemplate[]
        total: number
        page: number
        pageSize: number
        totalPages: number
      }>(await request.get(TEMPLATE_API, { params }))
      set({
        templates: data.items || [],
        templateTotal: data.total || 0,
        templatePage: data.page || 1,
        templatePageSize: data.pageSize || 20,
        templateTotalPages: data.totalPages || 0,
        templateLoading: false,
      })
    } catch (error) {
      set({ templateError: '获取模板列表失败', templateLoading: false })
      throw error
    }
  },

  /** 拉取模板分类及各类数量统计 */
  fetchTemplateCategories: async () => {
    try {
      const categories = getResponseData<TemplateCategoryCount[]>(
        await request.get(`${TEMPLATE_API}/categories`),
      )
      set({ templateCategories: categories || [] })
    } catch (error) {
      console.error('Failed to fetch template categories', error)
    }
  },

  /** 按 ID 拉取模板详情 */
  fetchTemplateById: async (id) =>
    getResponseData<WorkflowTemplate>(await request.get(`${TEMPLATE_API}/${id}`)),

  /** 创建模板（支持从现有工作流复制） */
  createTemplate: async (data) => {
    set({ templateLoading: true, templateError: null })
    try {
      const template = getResponseData<WorkflowTemplate>(await request.post(TEMPLATE_API, data))
      set({ templateLoading: false })
      return template
    } catch (error) {
      set({ templateError: '创建模板失败', templateLoading: false })
      throw error
    }
  },

  /** 更新模板基础信息 */
  updateTemplate: async (id, data) =>
    getResponseData<WorkflowTemplate>(await request.patch(`${TEMPLATE_API}/${id}`, data)),

  /** 发布模板（进入模板市场展示） */
  publishTemplate: async (id) =>
    getResponseData<WorkflowTemplate>(await request.post(`${TEMPLATE_API}/${id}/publish`)),

  /** 归档模板（从市场下架） */
  archiveTemplate: async (id) =>
    getResponseData<WorkflowTemplate>(await request.post(`${TEMPLATE_API}/${id}/archive`)),

  /** 从模板导入创建新工作流 */
  createFromTemplate: async (id, data) =>
    getResponseData<{
      workflowId: string
      name: string
      templateName: string
      templateId: string
    }>(await request.post(`${TEMPLATE_API}/${id}/import`, data)),

  /** 给模板评分，返回最新均分与评分人数 */
  rateTemplate: async (id, rating) =>
    getResponseData<{
      rating: number
      ratingCount: number
      yourRating: number
    }>(await request.post(`${TEMPLATE_API}/${id}/rate`, { rating })),

  /** 删除模板 */
  deleteTemplate: async (id) => {
    await request.delete(`${TEMPLATE_API}/${id}`)
  },
})
