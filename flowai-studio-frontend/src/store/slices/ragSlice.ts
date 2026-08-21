/**
 * RAG 知识库状态切片：管理知识库、文档及其分块检索。
 *
 * 覆盖知识库 CRUD、文档上传/删除、文档分块查看与向量检索（retrieve），
 * 上传/删除文档后会自动刷新列表，保证页面展示与后端一致。
 */
import { StateCreator } from 'zustand'
import { KnowledgeBase, Document, DocumentChunksResponse } from '../../types'
import request from '../../utils/axios'

/** RAG 切片对外暴露的状态与 Actions 类型 */
export interface RAGSlice {
  knowledgeBases: KnowledgeBase[]
  currentKnowledgeBase: KnowledgeBase | null
  documents: Document[]
  isLoading: boolean
  error: string | null
  
  // Actions
  setKnowledgeBases: (knowledgeBases: KnowledgeBase[]) => void
  setCurrentKnowledgeBase: (knowledgeBase: KnowledgeBase | null) => void
  setDocuments: (documents: Document[]) => void
  setIsLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  fetchKnowledgeBases: () => Promise<void>
  fetchKnowledgeBaseById: (id: string) => Promise<KnowledgeBase>
  createKnowledgeBase: (data: { name: string; description?: string; embeddingModel?: string; embeddingDimension?: number; chunkSize?: number; chunkOverlap?: number; topK?: number; similarityThreshold?: number; retrievalMode?: string }) => Promise<KnowledgeBase>
  updateKnowledgeBase: (id: string, data: { name?: string; description?: string; embeddingModel?: string; embeddingDimension?: number; chunkSize?: number; chunkOverlap?: number; topK?: number; similarityThreshold?: number; retrievalMode?: string }) => Promise<KnowledgeBase>
  deleteKnowledgeBase: (id: string) => Promise<void>
  uploadDocument: (knowledgeBaseId: string, file: File) => Promise<Document>
  deleteDocument: (documentId: string) => Promise<void>
  fetchDocumentChunks: (documentId: string) => Promise<DocumentChunksResponse>
  retrieve: (query: string, knowledgeBaseId: string, topK?: number) => Promise<any>
}

/** 创建 RAG 切片：提供知识库与文档的增删改查、上传与检索操作 */
export const createRAGSlice: StateCreator<RAGSlice> = (set, get) => ({
  knowledgeBases: [],
  currentKnowledgeBase: null,
  documents: [],
  isLoading: false,
  error: null,

  setKnowledgeBases: (knowledgeBases) => set({ knowledgeBases }),
  
  setCurrentKnowledgeBase: (knowledgeBase) => set({ currentKnowledgeBase: knowledgeBase }),
  
  setDocuments: (documents) => set({ documents }),
  
  setIsLoading: (loading) => set({ isLoading: loading }),
  
  setError: (error) => set({ error }),

  /** 拉取知识库列表 */
  fetchKnowledgeBases: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await request.get('/rag/knowledge-bases') as any
      const knowledgeBases = (Array.isArray(response.data) ? response.data : [])
      set({ knowledgeBases, isLoading: false })
    } catch (error) {
      set({ error: 'Failed to fetch knowledge bases', isLoading: false, knowledgeBases: [] })
      throw error
    }
  },

  /** 按 ID 拉取知识库详情，并同步其文档列表 */
  fetchKnowledgeBaseById: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const response = await request.get(`/rag/knowledge-bases/${id}`) as any
      const knowledgeBase = response.data
      set({ currentKnowledgeBase: knowledgeBase, documents: knowledgeBase.documents || [], isLoading: false })
      return knowledgeBase
    } catch (error) {
      set({ error: 'Failed to fetch knowledge base', isLoading: false })
      throw error
    }
  },

  /** 创建知识库：成功后追加到列表末尾 */
  createKnowledgeBase: async (data) => {
    set({ isLoading: true, error: null })
    try {
      const response = await request.post('/rag/knowledge-bases', data) as any
      const knowledgeBase = response.data
      const currentKBs = Array.isArray(get().knowledgeBases) ? get().knowledgeBases : []
      set({ 
        knowledgeBases: [...currentKBs, knowledgeBase],
        isLoading: false 
      })
      return knowledgeBase
    } catch (error) {
      set({ error: 'Failed to create knowledge base', isLoading: false })
      throw error
    }
  },

  /** 更新知识库配置：同步更新列表与当前知识库 */
  updateKnowledgeBase: async (id, data) => {
    set({ isLoading: true, error: null })
    try {
      const response = await request.patch(`/rag/knowledge-bases/${id}`, data) as any
      const updatedKnowledgeBase = response.data
      const currentKBs = Array.isArray(get().knowledgeBases) ? get().knowledgeBases : []
      set({
        knowledgeBases: currentKBs.map(kb => kb.id === id ? updatedKnowledgeBase : kb),
        currentKnowledgeBase: get().currentKnowledgeBase?.id === id ? updatedKnowledgeBase : get().currentKnowledgeBase,
        isLoading: false,
      })
      return updatedKnowledgeBase
    } catch (error) {
      set({ error: 'Failed to update knowledge base', isLoading: false })
      throw error
    }
  },

  /** 删除知识库：从列表移除，若删除的是当前知识库则清空 */
  deleteKnowledgeBase: async (id) => {
    set({ isLoading: true, error: null })
    try {
      await request.delete(`/rag/knowledge-bases/${id}`)
      set({
        knowledgeBases: get().knowledgeBases.filter(kb => kb.id !== id),
        currentKnowledgeBase: get().currentKnowledgeBase?.id === id ? null : get().currentKnowledgeBase,
        isLoading: false,
      })
    } catch (error) {
      set({ error: 'Failed to delete knowledge base', isLoading: false })
      throw error
    }
  },

  /** 上传文档：以 multipart/form-data 提交，成功后刷新列表与当前知识库 */
  uploadDocument: async (knowledgeBaseId, file) => {
    set({ isLoading: true, error: null })
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('knowledgeBaseId', knowledgeBaseId)

      const response = await request.post('/rag/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }) as any

      const document = response.data
      
      // 刷新知识库列表
      await get().fetchKnowledgeBases()
      
      // 刷新当前知识库的文档列表
      if (get().currentKnowledgeBase?.id === knowledgeBaseId) {
        await get().fetchKnowledgeBaseById(knowledgeBaseId)
      }

      set({ isLoading: false, error: null })
      return document
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        '文档上传失败'
      set({ error: message, isLoading: false })
      throw error
    }
  },

  /** 删除文档：成功后刷新知识库列表与当前知识库的文档列表 */
  deleteDocument: async (documentId) => {
    set({ isLoading: true, error: null })
    try {
      await request.delete(`/rag/documents/${documentId}`)
      
      // 刷新知识库列表
      await get().fetchKnowledgeBases()
      
      // 刷新当前知识库的文档列表
      if (get().currentKnowledgeBase) {
        await get().fetchKnowledgeBaseById(get().currentKnowledgeBase.id)
      }

      set({ isLoading: false })
    } catch (error) {
      set({ error: 'Failed to delete document', isLoading: false })
      throw error
    }
  },

  /** 拉取指定文档的分块结果（用于查看切分效果） */
  fetchDocumentChunks: async (documentId) => {
    set({ isLoading: true, error: null })
    try {
      const response = await request.get(`/rag/documents/${documentId}/chunks`) as any
      set({ isLoading: false })
      return response.data
    } catch (error) {
      set({ error: 'Failed to fetch document chunks', isLoading: false })
      throw error
    }
  },

  /** 向量检索：按 query 在指定知识库中召回 topK 条相关片段 */
  retrieve: async (query, knowledgeBaseId, topK = 5) => {
    set({ isLoading: true, error: null })
    try {
      const response = await request.post('/rag/retrieve', {
        query,
        knowledgeBaseId,
        topK,
      }) as any
      set({ isLoading: false })
      return response.data
    } catch (error) {
      set({ error: 'Failed to retrieve documents', isLoading: false })
      throw error
    }
  },
})
