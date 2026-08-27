/**
 * 工作流状态切片：管理工作流列表、画布节点/连线与实时运行状态。
 *
 * - 画布编辑（拖拽/连线/删除）由 React Flow 的 change 回调驱动；
 * - 运行状态分为普通 run 与 SSE 流式运行（streamRunWorkflow），
 *   后者逐节点更新 executionStates，供画布展示执行进度。
 */
import { StateCreator } from 'zustand'
import { Workflow, WorkflowNode, WorkflowEdge, NodeExecution } from '../../types'
import request from '../../utils/axios'
import { getStoredToken } from '../../utils/authStorage'
import { 
  Connection,
  OnNodesChange, 
  OnEdgesChange, 
  OnConnect, 
  applyNodeChanges, 
  applyEdgeChanges, 
  addEdge,
  reconnectEdge,
} from '@xyflow/react'

import { createParser } from 'eventsource-parser'

/** 工作流切片对外暴露的状态与 Actions 类型 */
export interface WorkflowSlice {
  workflows: Workflow[]
  currentWorkflow: Workflow | null
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  selectedNode: WorkflowNode | null
  canvasZoom: number
  executionStates: Record<string, NodeExecution>
  executionStatus: string | null
  workflowLoading: boolean
  
  // Actions
  setWorkflows: (workflows: Workflow[]) => void
  setCurrentWorkflow: (workflow: Workflow | null) => void
  setNodes: (nodes: WorkflowNode[]) => void
  setEdges: (edges: WorkflowEdge[]) => void
  onNodesChange: OnNodesChange<WorkflowNode>
  onEdgesChange: OnEdgesChange<WorkflowEdge>
  onConnect: OnConnect
  reconnectWorkflowEdge: (edge: WorkflowEdge, connection: Connection) => void
  setSelectedNode: (node: WorkflowNode | null) => void
  deleteNode: (nodeId: string) => void
  deleteEdge: (edgeId: string) => void
  updateNodeData: (nodeId: string, data: any) => void
  setCanvasZoom: (zoom: number) => void
  setExecutionState: (nodeId: string, state: NodeExecution) => void
  setExecutionStatus: (status: string | null) => void
  setExecutionStates: (states: Record<string, NodeExecution>) => void
  fetchWorkflows: (appId: string) => Promise<Workflow[]>
  fetchWorkflowById: (id: string) => Promise<Workflow>
  createWorkflow: (appId: string, data: { name: string; description?: string; nodes?: any[]; edges?: any[] }) => Promise<Workflow>
  updateWorkflow: (id: string, data: Partial<Workflow>) => Promise<Workflow>
  saveWorkflow: (id: string, data: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }) => Promise<Workflow>
  runWorkflow: (workflowId: string) => Promise<any>
  streamRunWorkflow: (workflowId: string, inputs: Record<string, any>) => Promise<void>
  deleteWorkflow: (id: string) => Promise<void>
  clearExecutionStates: () => void
}

/** 创建工作流切片：提供画布编辑、运行与 CRUD 操作 */
export const createWorkflowSlice: StateCreator<WorkflowSlice> = (set, get) => ({
  workflows: [],
  currentWorkflow: null,
  nodes: [],
  edges: [],
  selectedNode: null,
  canvasZoom: 1,
  executionStates: {},
  executionStatus: null,
  workflowLoading: false,

  setWorkflows: (workflows) => set({ workflows }),
  
  /** 切换当前工作流：同步把其节点与连线载入画布 */
  setCurrentWorkflow: (workflow) => {
    if (workflow) {
      set({ currentWorkflow: workflow, nodes: workflow.nodes, edges: workflow.edges })
    } else {
      set({ currentWorkflow: null, nodes: [], edges: [] })
    }
  },
  
  setNodes: (nodes) => set({ nodes }),
  
  setEdges: (edges) => set({ edges }),

  /** React Flow 节点变更回调：删除节点时同步清理其执行状态与选中态 */
  onNodesChange: (changes) => {
    set((state) => {
      const removedNodeIds = new Set(
        changes.filter((change) => change.type === 'remove').map((change) => change.id)
      )
      const executionStates = { ...state.executionStates }
      removedNodeIds.forEach((id) => delete executionStates[id])

      return {
        nodes: applyNodeChanges(changes, state.nodes),
        selectedNode: state.selectedNode && removedNodeIds.has(state.selectedNode.id)
          ? null
          : state.selectedNode,
        executionStates,
      }
    })
  },

  /** React Flow 连线变更回调 */
  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    })
  },

  /** 画布连线回调：把新连线追加到 edges */
  onConnect: (connection) => {
    set({
      edges: addEdge(connection, get().edges),
    })
  },

  /** 重连已有连线（换一头） */
  reconnectWorkflowEdge: (edge, connection) => {
    set((state) => ({
      edges: reconnectEdge(edge, connection, state.edges),
    }))
  },
  
  /** 设置画布当前选中的节点（用于右侧配置面板） */
  setSelectedNode: (node) => set({ selectedNode: node }),

  /** 删除节点：同时移除关联连线、执行状态与选中态 */
  deleteNode: (nodeId) => {
    set((state) => {
      const executionStates = { ...state.executionStates }
      delete executionStates[nodeId]

      return {
        nodes: state.nodes.filter((node) => node.id !== nodeId),
        edges: state.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
        selectedNode: state.selectedNode?.id === nodeId ? null : state.selectedNode,
        executionStates,
      }
    })
  },

  /** 删除单条连线 */
  deleteEdge: (edgeId) => {
    set((state) => ({
      edges: state.edges.filter((edge) => edge.id !== edgeId),
    }))
  },
  
  /** 更新节点配置数据：同步反映到画布与当前选中节点 */
  updateNodeData: (nodeId, data) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
      ),
      // 如果当前选中的是这个节点，同步更新选中的节点数据
      selectedNode: state.selectedNode?.id === nodeId 
        ? { ...state.selectedNode, data: { ...state.selectedNode.data, ...data } }
        : state.selectedNode
    }));
  },
  
  /** 记录画布缩放比例 */
  setCanvasZoom: (zoom) => set({ canvasZoom: zoom }),
  
  /** 更新单个节点的运行状态（用于画布高亮） */
  setExecutionState: (nodeId, state) => {
    set({
      executionStates: {
        ...get().executionStates,
        [nodeId]: state,
      },
    })
  },
  
  setExecutionStatus: (status) => set({ executionStatus: status }),
  
  setExecutionStates: (states) => set({ executionStates: states }),
  
  /** 普通方式运行工作流：不接收节点级流式输出 */
  runWorkflow: async (workflowId) => {
    set({ workflowLoading: true, executionStatus: 'running', executionStates: {} })
    try {
      const response = await request.post(`/workflows/${workflowId}/run`, { inputs: {} })
      set({ workflowLoading: false, executionStatus: 'success' })
      return response.data
    } catch (error) {
      set({ workflowLoading: false, executionStatus: 'failed' })
      throw error
    }
  },

  /**
   * 流式运行工作流：通过 SSE 接收节点状态事件，
   * 逐节点更新 executionStates 并在结束时切换整体状态。
   */
  streamRunWorkflow: async (workflowId, inputs) => {
    set({ executionStatus: 'running', executionStates: {} })
    
    try {
      const response = await fetch(`/api/workflows/${workflowId}/run/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getStoredToken()}`
        },
        body: JSON.stringify({ inputs })
      })

      if (!response.ok) throw new Error('Stream request failed')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader available')

      const parser = createParser((event) => {
        if (event.type === 'event') {
          try {
            const data = JSON.parse(event.data)
            if (data.type === 'node_status') {
              const { nodeId, status, output, error } = data.data
              set((state) => ({
                executionStates: {
                  ...state.executionStates,
                  [nodeId]: { nodeId, status, output, error }
                }
              }))
            } else if (data.type === 'done') {
              set({ executionStatus: 'success' })
            } else if (data.type === 'error') {
              set({ executionStatus: 'failed' })
            }
          } catch (e) {
            console.error('Error parsing SSE data:', e)
          }
        }
      })

      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        parser.feed(decoder.decode(value))
      }
    } catch (error) {
      set({ executionStatus: 'failed' })
      throw error
    }
  },

  /** 拉取某应用下的工作流列表 */
  fetchWorkflows: async (appId) => {
    set({ workflowLoading: true })
    try {
      const response = await request.get(`/workflows/app/${appId}`) as any
      const workflows = (Array.isArray(response.data) ? response.data : []) as Workflow[]
      set({ workflows, workflowLoading: false })
      return workflows
    } catch (error) {
      set({ workflowLoading: false })
      set({ workflows: [] })
      throw error
    }
  },

  /** 按 ID 拉取工作流并载入画布（节点/连线） */
  fetchWorkflowById: async (id) => {
    set({ workflowLoading: true })
    try {
      const response = await request.get(`/workflows/${id}`) as any
      const workflow = response.data as Workflow
      set({ currentWorkflow: workflow, nodes: workflow.nodes || [], edges: workflow.edges || [], workflowLoading: false })
      return workflow
    } catch (error) {
      set({ workflowLoading: false })
      throw error
    }
  },

  /** 创建工作流：成功后追加到列表末尾 */
  createWorkflow: async (appId, data) => {
    set({ workflowLoading: true })
    try {
      const response = await request.post('/workflows', { ...data, applicationId: appId }) as any
      const workflow = response.data as Workflow
      const currentWorkflows = Array.isArray(get().workflows) ? get().workflows : []
      set({ workflows: [...currentWorkflows, workflow], workflowLoading: false })
      return workflow
    } catch (error) {
      set({ workflowLoading: false })
      throw error
    }
  },

  /** 更新工作流：同步更新列表与当前工作流 */
  updateWorkflow: async (id, data) => {
    set({ workflowLoading: true })
    try {
      const response = await request.patch(`/workflows/${id}`, data) as any
      const updatedWorkflow = response.data as Workflow
      const currentWorkflows = Array.isArray(get().workflows) ? get().workflows : []
      
      set({
        workflows: currentWorkflows.map((wf) => wf.id === id ? updatedWorkflow : wf),
        currentWorkflow: get().currentWorkflow?.id === id ? updatedWorkflow : get().currentWorkflow,
        workflowLoading: false,
      })
      
      return updatedWorkflow
    } catch (error) {
      set({ workflowLoading: false })
      throw error
    }
  },

  /** 保存画布：仅更新当前工作流的节点与连线 */
  saveWorkflow: async (id, data) => {
    set({ workflowLoading: true })
    try {
      const response = await request.patch(`/workflows/${id}`, data) as any
      const updatedWorkflow = response.data as Workflow
      set({ currentWorkflow: updatedWorkflow, workflowLoading: false })
      return updatedWorkflow
    } catch (error) {
      set({ workflowLoading: false })
      throw error
    }
  },

  /** 删除工作流：若删除的是当前工作流则清空画布 */
  deleteWorkflow: async (id) => {
    set({ workflowLoading: true })
    try {
      await request.delete(`/workflows/${id}`)
      set({
        workflows: get().workflows.filter((wf) => wf.id !== id),
        currentWorkflow: get().currentWorkflow?.id === id ? null : get().currentWorkflow,
        workflowLoading: false,
      })
    } catch (error) {
      set({ workflowLoading: false })
      throw error
    }
  },

  /** 清空全部节点执行状态（运行开始前调用） */
  clearExecutionStates: () => set({ executionStates: {} }),
})
