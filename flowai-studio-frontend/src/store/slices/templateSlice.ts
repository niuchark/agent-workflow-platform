import { StateCreator } from 'zustand'
import { WorkflowTemplate, TemplateCategoryCount, TemplateSort, TemplateCategory } from '../../types'
import request, { getResponseData } from '../../utils/axios'

const TEMPLATE_API = '/templates'

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

export const createTemplateSlice: StateCreator<TemplateSlice> = (set) => ({
  templates: [],
  templateTotal: 0,
  templatePage: 1,
  templatePageSize: 20,
  templateTotalPages: 0,
  templateCategories: [],
  templateLoading: false,
  templateError: null,

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

  fetchTemplateById: async (id) => {
    try {
      return getResponseData<WorkflowTemplate>(await request.get(`${TEMPLATE_API}/${id}`))
    } catch (error) {
      throw error
    }
  },

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

  updateTemplate: async (id, data) => {
    try {
      return getResponseData<WorkflowTemplate>(await request.patch(`${TEMPLATE_API}/${id}`, data))
    } catch (error) {
      throw error
    }
  },

  publishTemplate: async (id) => {
    try {
      return getResponseData<WorkflowTemplate>(await request.post(`${TEMPLATE_API}/${id}/publish`))
    } catch (error) {
      throw error
    }
  },

  archiveTemplate: async (id) => {
    try {
      return getResponseData<WorkflowTemplate>(await request.post(`${TEMPLATE_API}/${id}/archive`))
    } catch (error) {
      throw error
    }
  },

  createFromTemplate: async (id, data) => {
    try {
      return getResponseData<{
        workflowId: string
        name: string
        templateName: string
        templateId: string
      }>(await request.post(`${TEMPLATE_API}/${id}/import`, data))
    } catch (error) {
      throw error
    }
  },

  rateTemplate: async (id, rating) => {
    try {
      return getResponseData<{
        rating: number
        ratingCount: number
        yourRating: number
      }>(await request.post(`${TEMPLATE_API}/${id}/rate`, { rating }))
    } catch (error) {
      throw error
    }
  },

  deleteTemplate: async (id) => {
    try {
      await request.delete(`${TEMPLATE_API}/${id}`)
    } catch (error) {
      throw error
    }
  },
})
