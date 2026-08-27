/**
 * 工作流版本管理 API：封装快照、列表、详情、对比、回滚与删除接口。
 *
 * 后端路由位于 `workflows/:workflowId/versions`，返回内容与
 * WorkflowVersionService 的序列化结构保持一致。
 */
import request from './axios'
import type { WorkflowEdge, WorkflowNode } from '../types'

/** 版本列表元数据（不含完整快照内容） */
export interface WorkflowVersionMeta {
  id: string
  version: number
  label?: string | null
  description?: string | null
  createdBy?: string | null
  isPublished: boolean
  createdAt: string
}

/** 版本详情（含完整快照） */
export interface WorkflowVersionDetail extends WorkflowVersionMeta {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  variables: Record<string, unknown> | null
}

/** 创建版本快照的请求体 */
export interface CreateWorkflowVersionPayload {
  label?: string
  description?: string
  isPublished?: boolean
}

/** 字段级变更 */
export interface WorkflowFieldChange {
  field: string
  oldValue: unknown
  newValue: unknown
}

/** 修改节点及字段变更 */
export interface ModifiedWorkflowNode {
  id: string
  type: string
  changes: WorkflowFieldChange[]
}

/** 结构化工作流 Diff */
export interface WorkflowVersionDiff {
  addedNodes: WorkflowNode[]
  removedNodes: WorkflowNode[]
  modifiedNodes: ModifiedWorkflowNode[]
  addedEdges: WorkflowEdge[]
  removedEdges: WorkflowEdge[]
  summary: {
    nodesAdded: number
    nodesRemoved: number
    nodesModified: number
    edgesAdded: number
    edgesRemoved: number
    hasChanges: boolean
  }
}

/** 回滚结果 */
export interface WorkflowRollbackResult {
  id: string
  name: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  variables: Record<string, unknown> | null
  currentVersion: number
  updatedAt: string
  rolledBackTo: number
  backupVersion: number
}

/** 兼容 Axios 响应拦截器可能返回 data，也可能返回完整响应 */
const unwrap = <T>(payload: unknown, fallback: T): T => {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    const data = (payload as { data?: unknown }).data
    return (data ?? payload) as T
  }
  return (payload ?? fallback) as T
}

/** 获取工作流版本列表 */
export async function listWorkflowVersions(workflowId: string): Promise<WorkflowVersionMeta[]> {
  const payload = unwrap(await request.get(`/workflows/${workflowId}/versions`, { cacheBust: true }), [])
  return Array.isArray(payload) ? payload : []
}

/** 获取指定版本详情 */
export async function getWorkflowVersion(
  workflowId: string,
  version: number,
): Promise<WorkflowVersionDetail> {
  return unwrap(await request.get(`/workflows/${workflowId}/versions/${version}`), null)
}

/** 创建版本快照 */
export async function createWorkflowVersion(
  workflowId: string,
  data: CreateWorkflowVersionPayload,
): Promise<WorkflowVersionDetail> {
  return unwrap(await request.post(`/workflows/${workflowId}/versions`, data), null)
}

/** 回滚到指定版本 */
export async function rollbackWorkflowVersion(
  workflowId: string,
  version: number,
): Promise<WorkflowRollbackResult> {
  return unwrap(await request.post(`/workflows/${workflowId}/versions/${version}/rollback`), null)
}

/** 删除指定版本 */
export async function deleteWorkflowVersion(
  workflowId: string,
  version: number,
): Promise<{ success: boolean; deletedVersion: number }> {
  return unwrap(await request.delete(`/workflows/${workflowId}/versions/${version}`), null)
}

/** 对比两个版本；version 传 0 表示当前工作流状态 */
export async function compareWorkflowVersions(
  workflowId: string,
  fromVersion: number,
  toVersion: number,
): Promise<{ fromVersion: number; toVersion: number; diff: WorkflowVersionDiff }> {
  return unwrap(
    await request.get(`/workflows/${workflowId}/versions/compare`, {
      params: { from: fromVersion, to: toVersion },
      cacheBust: true,
    }),
    null,
  )
}
