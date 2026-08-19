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

// 自定义节点类型
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

interface WorkflowCanvasProps {
  onNodeSelect?: (node: WorkflowNode) => void
}

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
  const reconnectSuccessful = useRef(true)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const { screenToFlowPosition } = useReactFlow()

  const onNodeClick = useCallback((event: React.MouseEvent, node: any) => {
    setSelectedEdgeId(null)
    setSelectedNode(node)
    onNodeSelect?.(node)
  }, [onNodeSelect, setSelectedNode])

  const onEdgeClick = useCallback(() => {
    setSelectedNode(null)
  }, [setSelectedNode])

  const onReconnectStart = useCallback(() => {
    reconnectSuccessful.current = false
  }, [])

  const onReconnect = useCallback((edge: WorkflowEdge, connection: Connection) => {
    reconnectSuccessful.current = true
    reconnectWorkflowEdge(edge, connection)
    messageApi.success('连线已重新连接')
  }, [messageApi, reconnectWorkflowEdge])

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

  const onNodesDelete = useCallback((deletedNodes: WorkflowNode[]) => {
    if (deletedNodes.length > 0) {
      setSelectedNode(null)
      messageApi.success(`已删除 ${deletedNodes.length} 个节点`)
    }
  }, [messageApi, setSelectedNode])

  const onEdgesDelete = useCallback((deletedEdges: WorkflowEdge[]) => {
    if (deletedEdges.length > 0) {
      setSelectedEdgeId(null)
      messageApi.success(`已删除 ${deletedEdges.length} 条连线`)
    }
  }, [messageApi])

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const type = event.dataTransfer.getData('application/reactflow') as NodeType

      // check if the dropped element is valid
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
        onSelectionChange={({ edges: selectedEdges }) => {
          setSelectedEdgeId(selectedEdges[0]?.id ?? null)
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
