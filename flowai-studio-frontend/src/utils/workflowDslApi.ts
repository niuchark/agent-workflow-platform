import request from './axios'

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
): Promise<{
  valid: boolean
  errors: string[]
  warnings: string[]
}> {
  return request.post('/workflow-dsl/validate', { dsl, format })
}

/**
 * 导入工作流 DSL
 */
export async function importWorkflowDsl(data: {
  dsl: string
  format: 'yaml' | 'json'
  applicationId: string
  nameOverride?: string
}): Promise<{
  workflow: {
    id: string
    name: string
    description: string | null
    createdAt: string
    updatedAt: string
  }
  idMap: Record<string, string>
}> {
  return request.post('/workflow-dsl/import', data)
}
