/**
 * 节点库面板：左侧展示所有可拖拽的节点类型。
 *
 * 拖拽时把节点类型写入 dataTransfer（application/reactflow），
 * 由 WorkflowCanvas 的 onDrop 读取并创建对应节点。
 */
import { useCallback } from 'react'
import {
  PlayCircleOutlined,
  UserOutlined,
  MessageOutlined,
  BookOutlined,
  ToolOutlined,
  BranchesOutlined,
  ExportOutlined,
  RobotOutlined,
} from '@ant-design/icons'

/** 节点库中的一种节点类型及其展示信息 */
interface NodeType {
  type: string
  label: string
  icon: React.ReactNode
  color: string
}

/** 节点库全部可选节点：类型、中文名、图标与主题色 */
const nodeTypes: NodeType[] = [
  { type: 'start', label: '开始', icon: <PlayCircleOutlined />, color: '#0284c7' },
  { type: 'userInput', label: '用户输入', icon: <UserOutlined />, color: '#059669' },
  { type: 'llm', label: '大模型', icon: <MessageOutlined />, color: '#0284c7' },
  { type: 'agent', label: '智能体', icon: <RobotOutlined />, color: '#8b5cf6' },
  { type: 'rag', label: 'RAG检索', icon: <BookOutlined />, color: '#d97706' },
  { type: 'skill', label: '工具', icon: <ToolOutlined />, color: '#0891b2' },
  { type: 'condition', label: '条件分支', icon: <BranchesOutlined />, color: '#dc2626' },
  { type: 'output', label: '输出', icon: <ExportOutlined />, color: '#059669' },
]

/** 节点库面板组件：渲染节点列表并支持拖拽到画布 */
const NodePanel: React.FC = () => {
  /** 拖拽开始：把节点类型写入剪贴板数据 */
  const onDragStart = useCallback((event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType)
    event.dataTransfer.effectAllowed = 'copy'
  }, [])

  return (
    <div className="node-panel">
      <div className="node-panel-header">
        <h3>节点库</h3>
        <p>拖拽下方节点到右侧画布中</p>
      </div>
      <div className="node-panel-content">
        {nodeTypes.map((nodeType) => (
          <div
            key={nodeType.type}
            className="node-item"
            draggable
            onDragStart={(e) => onDragStart(e, nodeType.type)}
          >
            <div className="node-item-icon" style={{ color: nodeType.color }}>
              {nodeType.icon}
            </div>
            <div className="node-item-label">{nodeType.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default NodePanel
