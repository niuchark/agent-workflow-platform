/**
 * 智能体节点：单智能体或多智能体（supervisor + workers）模式。
 *
 * 在节点卡片内展示模式、模型、Worker 数量、RAG 与工具启用情况，
 * 便于不打开配置面板也能快速识别节点能力。
 */
import { Handle, Position } from '@xyflow/react'
import { RobotOutlined } from '@ant-design/icons'
import BaseNode from './BaseNode'
import { AgentNodeData } from '../../../types'

/** 智能体节点 props */
interface AgentNodeProps {
  data: AgentNodeData
  id: string
  selected?: boolean
}

/** 智能体节点组件 */
const AgentNode: React.FC<AgentNodeProps> = ({ data, id }) => {
  // 展示用文案：supervisor 模式显示"多智能体"
  const modeLabel = data.agentMode === 'supervisor' ? '多智能体' : '单智能体'
  // Worker 数量（仅 supervisor 模式有意义）
  const workerCount = data.agentMode === 'supervisor' ? (data.workers?.length || 0) : 0

  return (
    <BaseNode
      id={id}
      label={data.label || '智能体'}
      icon={<RobotOutlined />}
      color="#8b5cf6"
      width={200}
    >
      <Handle type="target" position={Position.Left} />
      <div style={{ padding: '4px 0', fontSize: 12, color: '#666' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{modeLabel}</span>
          <span>{data.model || 'qwen-turbo'}</span>
        </div>
        {data.agentMode === 'supervisor' && workerCount > 0 && (
          <div style={{ marginTop: 2, color: '#8b5cf6' }}>
            {workerCount} 个 Worker
          </div>
        )}
        {data.ragEnabled && (
          <div style={{ marginTop: 2, color: '#d97706', fontSize: 11 }}>
            📚 RAG 已启用
          </div>
        )}
        {(data.toolIds && data.toolIds.length > 0) && (
          <div style={{ marginTop: 2, color: '#0891b2', fontSize: 11 }}>
            🔧 {data.toolIds.length} 个工具
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </BaseNode>
  )
}

export default AgentNode
