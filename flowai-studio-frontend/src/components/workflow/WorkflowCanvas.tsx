/**
 * 工作流画布组件：基于 React Flow 的节点编辑区。
 *
 * 负责：
 * - 渲染节点/连线，并把 store 中的编辑回调接入 React Flow；
 * - 从节点库拖入新节点（onDrop）并生成默认配置；
 * - 节点点击回调 onNodeSelect，供父组件打开右侧配置面板；
 * - 连线重连与删除前的二次确认，以及删除后的提示。
 */
import { useCallback, useRef, useState } from 'react'
import { ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  type Connection,
} from '@xyflow/react'
import { Modal, message } from 'antd'
import '@xyflow/react/dist/style.css'
import { useStore } from '../../store'
import StartNode from './nodes/StartNode'
import UserInputNode from './nodes/UserInputNode'
import LLMNode from './nodes/LLMNode'
import RAGNode from './nodes/RAGNode'
import SkillNode from './nodes/SkillNode'
import ConditionNode from './nodes/ConditionNode'
import OutputNode from './nodes/OutputNode'
import AgentNode from './nodes/AgentNode'
import { NodeType, WorkflowEdge, WorkflowNode } from '../../types'

/** 节点类型 → 画布渲染组件的映射 */
const nodeTypes = {
  start: StartNode,
  userInput: UserInputNode,
  llm: LLMNode,
  rag: RAGNode,
  skill: SkillNode,
  condition: ConditionNode,
  output: OutputNode,
  agent: AgentNode,
}

/** 按节点类型生成默认配置数据（拖入画布时使用） */
const createNodeData = (type: NodeType): WorkflowNode['data'] => {
  switch (type) {
    case 'start':
      return { label: '开始', variables: [] }
    case 'userInput':
      return { label: '用户输入', inputField: '' }
    case 'llm':
      return {
        label: '大模型',
        provider: 'qwen',
        model: 'qwen-turbo',
        systemPrompt: '',
        userPrompt: '',
        temperature: 0.7,
        maxTokens: 1024,
      }
    case 'rag':
      return {
        label: 'RAG检索',
        knowledgeBaseId: '',
        query: '',
        topK: 3,
        similarityThreshold: 0.7,
      }
    case 'skill':
      return {
        label: '工具',
        skillId: '',
        skillType: 'builtin',
        parameters: {},
      }
    case 'condition':
      return { label: '条件分支', conditions: [] }
    case 'output':
      return { label: '输出', outputValue: '' }
    case 'agent':
      return {
        label: '智能体',
        agentMode: 'single',
        strategy: 'react',
        provider: 'qwen',
        model: 'qwen-turbo',
        systemPrompt: '',
        userPrompt: '',
        temperature: 0.7,
        maxTokens: 2048,
        maxIterations: 10,
        toolIds: [],
        knowledgeBaseIds: [],
        ragEnabled: false,
        memoryEnabled: false,
        memoryWindowSize: 10,
      }
  }
}

/** 画布组件 props */
interface WorkflowCanvasProps {
  /** 节点被点击时的回调（由父组件打开配置面板） */
  onNodeSelect?: (node: WorkflowNode) => void
}

/** 工作流画布组件 */
const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({ onNodeSelect }) => {
  const [modal, modalContextHolder] = Modal.useModal()
  const [messageApi, messageContextHolder] = message.useMessage()
  const { 
    nodes, 
    edges, 
    onNodesChange,
    onEdgesChange,
    onConnect,
    reconnectWorkflowEdge,
    deleteEdge,
    setNodes,
    setSelectedNode,
  } = useStore()

  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  // 记录本次重连是否成功，用于判断是否需要"断开连线"确认
  const reconnectSuccessful = useRef(true)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const { screenToFlowPosition } = useReactFlow()

  /** 节点点击：选中节点并通知父组件打开配置面板 */
  const onNodeClick = useCallback((event: React.MouseEvent, node: any) => {
    setSelectedEdgeId(null)
    setSelectedNode(node)
    onNodeSelect?.(node)
  }, [onNodeSelect, setSelectedNode])

  /** 连线点击：清空节点选中态 */
  const onEdgeClick = useCallback(() => {
    setSelectedNode(null)
  }, [setSelectedNode])

  /** 重连开始：重置成功标记 */
  const onReconnectStart = useCallback(() => {
    reconnectSuccessful.current = false
  }, [])

  /** 重连成功：更新连线并提示 */
  const onReconnect = useCallback((edge: WorkflowEdge, connection: Connection) => {
    reconnectSuccessful.current = true
    reconnectWorkflowEdge(edge, connection)
    messageApi.success('连线已重新连接')
  }, [messageApi, reconnectWorkflowEdge])

  /** 重连结束：若未成功则弹窗询问是否断开原连线 */
  const onReconnectEnd = useCallback((_event: MouseEvent | TouchEvent, edge: WorkflowEdge) => {
    if (reconnectSuccessful.current) {
      return
    }

    modal.confirm({
      title: '断开这条连线？',
      content: '端点没有连接到新的节点接口。选择“断开”会删除这条连线，选择“保留连线”则恢复原连接。',
      okText: '断开',
      okType: 'danger',
      cancelText: '保留连线',
      onOk: () => {
        deleteEdge(edge.id)
        setSelectedEdgeId(null)
        messageApi.success('已断开连线')
      },
    })
  }, [deleteEdge, messageApi, modal])

  /** 删除前确认：节点与连线统一弹窗二次确认 */
  const onBeforeDelete = useCallback(({ nodes: nodesToDelete, edges: edgesToDelete }: {
    nodes: WorkflowNode[]
    edges: WorkflowEdge[]
  }) => new Promise<boolean>((resolve) => {
    const nodeCount = nodesToDelete.length
    const edgeCount = edgesToDelete.length
    const title = nodeCount > 0
      ? `删除选中的 ${nodeCount} 个节点？`
      : `删除选中的 ${edgeCount} 条连线？`
    const content = nodeCount > 0
      ? '相关连线也会一并删除。保存工作流前仍可通过重新加载页面放弃本次修改。'
      : '删除后需要重新连接节点才能恢复该执行路径。'

    modal.confirm({
      title,
      content,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  }), [modal])

  /** 节点删除后：清空选中并提示 */
  const onNodesDelete = useCallback((deletedNodes: WorkflowNode[]) => {
    if (deletedNodes.length > 0) {
      setSelectedNode(null)
      messageApi.success(`已删除 ${deletedNodes.length} 个节点`)
    }
  }, [messageApi, setSelectedNode])

  /** 连线删除后：清空选中连线并提示 */
  const onEdgesDelete = useCallback((deletedEdges: WorkflowEdge[]) => {
    if (deletedEdges.length > 0) {
      setSelectedEdgeId(null)
      messageApi.success(`已删除 ${deletedEdges.length} 条连线`)
    }
  }, [messageApi])

  /** 拖拽经过画布：允许放置 */
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  /** 放下节点：按拖入类型创建节点并放到鼠标位置 */
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const type = event.dataTransfer.getData('application/reactflow') as NodeType

      // 校验拖入类型是否合法
      if (typeof type === 'undefined' || !type) {
        return
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      
      const newNode: WorkflowNode = {
        id: `${type}_${Date.now()}`,
        type,
        position,
        data: createNodeData(type),
      }

      setNodes([...nodes, newNode])
    },
    [screenToFlowPosition, nodes, setNodes]
  )

  return (
    <>
      {modalContextHolder}
      {messageContextHolder}
      <div className="workflow-canvas" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onReconnectStart={onReconnectStart}
        onReconnect={onReconnect}
        onReconnectEnd={onReconnectEnd}
        edgesReconnectable
        reconnectRadius={20}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onSelectionChange={({ nodes: selectedNodes, edges: selectedEdges }) => {
          const nextSelectedNode = selectedNodes[0] as WorkflowNode | undefined
          setSelectedEdgeId(selectedEdges[0]?.id ?? null)
          if (useStore.getState().selectedNode?.id !== nextSelectedNode?.id) {
            setSelectedNode(nextSelectedNode ?? null)
            if (nextSelectedNode) onNodeSelect?.(nextSelectedNode)
          }
        }}
        onPaneClick={() => {
          setSelectedNode(null)
          setSelectedEdgeId(null)
        }}
        onBeforeDelete={onBeforeDelete}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        deleteKeyCode={['Backspace', 'Delete']}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="top-right"
      >
        <Background color="#f0f0f0" gap={16} />
        <Controls />
        <MiniMap />
      </ReactFlow>
      {selectedEdgeId && (
        <div className="workflow-edge-hint" role="status">
          拖动连线端点可重新连接 · Delete / Backspace 可断开
        </div>
      )}
      </div>
    </>
  )
}

export default WorkflowCanvas
