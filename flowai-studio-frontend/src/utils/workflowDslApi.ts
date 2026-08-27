/**
 * 工作流 DSL API：封装 DSL 的导出、校验与导入。
 *
 * DSL 是工作流节点/连线的声明式表示（YAML/JSON），
 * 用于工作流的备份、迁移与批量创建。
 */
import request, { getResponseData } from './axios'

export interface WorkflowDslValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/** 后端导入接口返回新建后的扁平工作流及旧/新节点 ID 映射。 */
export interface ImportedWorkflowDsl {
  id: string
  name: string
  description: string | null
  nodes: unknown[]
  edges: unknown[]
  variables: unknown
  createdAt: string
  updatedAt: string
  idMapping: Record<string, string>
}

/**
 * 导出工作流 DSL
 * @param workflowId 工作流 ID
 * @param format 导出格式: yaml | json
 * @returns Blob 数据，可直接用于下载
 */
export async function exportWorkflowDsl(
  workflowId: string,
  format: 'yaml' | 'json' = 'yaml',
): Promise<Blob> {
  const response = await request.get(`/workflow-dsl/${workflowId}/export`, {
    params: { format },
    responseType: 'blob',
  })
  return response as unknown as Blob
}

/**
 * 验证 DSL 内容
 */
export async function validateWorkflowDsl(
  dsl: string,
  format: 'yaml' | 'json' = 'yaml',
): Promise<WorkflowDslValidationResult> {
  return getResponseData<WorkflowDslValidationResult>(
    await request.post('/workflow-dsl/validate', { dsl, format }),
  )
}

/**
 * 导入工作流 DSL
 */
export async function importWorkflowDsl(data: {
  dsl: string
  format: 'yaml' | 'json'
  applicationId: string
  nameOverride?: string
}): Promise<ImportedWorkflowDsl> {
  return getResponseData<ImportedWorkflowDsl>(
    await request.post('/workflow-dsl/import', data),
  )
}
