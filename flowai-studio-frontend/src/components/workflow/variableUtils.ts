/**
 * 工作流变量工具：解析画布上"上游节点输出 → 变量引用"的关系。
 *
 * - getAvailableVariables 根据连线拓扑计算当前选中节点可引用的变量；
 * - getInvalidVariableReferences 校验文本中的 {{node.field}} 引用，
 *   识别指向已删除节点或不可用输出的失效引用。
 */
import { WorkflowEdge, WorkflowNode } from '../../types'

/** 一个可引用的变量选项（供变量下拉与提示展示） */
export interface WorkflowVariableOption {
  nodeId: string
  nodeLabel: string
  field: string
  fieldLabel: string
  path: string
  token: string
}

/** 失效变量引用（在编辑器中标红提示） */
export interface InvalidVariableReference {
  path: string
  token: string
  reason: 'missing-node' | 'unavailable-output'
}

/** 已知的节点输出字段名：用于判断引用是否指向被删除的节点 */
const KNOWN_OUTPUT_FIELDS = new Set([
  'result',
  'documents',
  'finalOutput',
  'messages',
  'success',
])

/** 按节点类型返回其可输出的字段列表 */
const getNodeOutputFields = (node: WorkflowNode): Array<{ field: string; label: string }> => {
  const data = node.data as any

  switch (node.type) {
    case 'start':
      return Array.isArray(data.variables)
        ? data.variables
            .filter((variable: any) => typeof variable?.key === 'string' && variable.key.trim())
            .map((variable: any) => ({ field: variable.key.trim(), label: '初始变量' }))
        : []
    case 'userInput':
      return data.inputField?.trim()
        ? [{ field: data.inputField.trim(), label: '用户输入' }]
        : []
    case 'llm':
      return [{ field: 'result', label: '模型回答' }]
    case 'agent':
      return [{ field: 'result', label: '智能体回答' }]
    case 'rag':
      return [{ field: 'documents', label: '检索文档' }]
    case 'skill':
      return [{ field: 'result', label: '工具结果' }]
    case 'condition':
      return [{ field: 'result', label: '判断结果' }]
    case 'output':
      return [{ field: 'finalOutput', label: '最终输出' }]
    default:
      return []
  }
}

/** 通过连线反向遍历，收集目标节点的全部上游节点 ID */
const getUpstreamNodeIds = (nodeId: string, edges: WorkflowEdge[]): Set<string> => {
  const sourcesByTarget = new Map<string, string[]>()

  edges.forEach((edge) => {
    const sources = sourcesByTarget.get(edge.target) || []
    sources.push(edge.source)
    sourcesByTarget.set(edge.target, sources)
  })

  const upstream = new Set<string>()
  const pending = [...(sourcesByTarget.get(nodeId) || [])]

  while (pending.length > 0) {
    const current = pending.shift()!
    if (current === nodeId || upstream.has(current)) continue

    upstream.add(current)
    pending.push(...(sourcesByTarget.get(current) || []))
  }

  return upstream
}

/** 获取当前选中节点的可用变量：仅包含上游节点的输出字段 */
export const getAvailableVariables = (
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  selectedNodeId: string,
): WorkflowVariableOption[] => {
  const upstreamNodeIds = getUpstreamNodeIds(selectedNodeId, edges)

  return nodes.flatMap((node) => {
    if (!upstreamNodeIds.has(node.id)) return []

    const nodeLabel = String((node.data as any)?.label || node.id)
    return getNodeOutputFields(node).map(({ field, label }) => {
      const path = `${node.id}.${field}`
      return {
        nodeId: node.id,
        nodeLabel,
        field,
        fieldLabel: label,
        path,
        token: `{{${path}}}`,
      }
    })
  })
}

/** 校验文本中的变量引用，返回失效引用列表（供编辑器提示） */
export const getInvalidVariableReferences = (
  value: unknown,
  availableVariables: WorkflowVariableOption[],
  nodes: WorkflowNode[],
): InvalidVariableReference[] => {
  if (typeof value !== 'string') return []

  const availablePaths = availableVariables.map((variable) => variable.path)
  const allNodeIds = new Set(nodes.map((node) => node.id))
  const invalid = new Map<string, InvalidVariableReference>()
  const referencePattern = /\{\{(.+?)\}\}/g

  for (const match of value.matchAll(referencePattern)) {
    const path = match[1].trim()
    const [nodeId, field] = path.split('.')

    // Top-level run inputs such as {{question}} remain valid and user-defined.
    if (!field) continue

    const matchesAvailableOutput = availablePaths.some(
      (availablePath) => path === availablePath || path.startsWith(`${availablePath}.`),
    )
    if (matchesAvailableOutput) continue

    if (allNodeIds.has(nodeId)) {
      invalid.set(path, {
        path,
        token: match[0],
        reason: 'unavailable-output',
      })
      continue
    }

    // Avoid flagging arbitrary nested run inputs. A known node output name is a
    // strong signal that this is a stale reference to a deleted node.
    if (KNOWN_OUTPUT_FIELDS.has(field)) {
      invalid.set(path, {
        path,
        token: match[0],
        reason: 'missing-node',
      })
    }
  }

  return [...invalid.values()]
}
