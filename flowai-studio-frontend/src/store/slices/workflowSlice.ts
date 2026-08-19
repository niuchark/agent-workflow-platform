import { StateCreator } from 'zustand'
import { Workflow, WorkflowNode, WorkflowEdge, NodeExecution } from '../../types'
import request from '../../utils/axios'
import { 
  OnNodesChange, 
  OnEdgesChange, 
  OnConnect, 
  applyNodeChanges, 
  applyEdgeChanges, 
  addEdge 
} from '@xyflow/react'

import { createParser } from 'eventsource-parser'

export interface WorkflowSlice {
  workflows: Workflow[]
  currentWorkflow: Workflow | null
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  selectedNode: WorkflowNode | null
  canvasZoom: number
  executionStates: Record<string, NodeExecution>
  executionStatus: string | null
  isLoading: boolean
  
  // Actions
  setWorkflows: (workflows: Workflow[]) => void
  setCurrentWorkflow: (workflow: Workflow | null) => void
  setNodes: (nodes: WorkflowNode[]) => void
  setEdges: (edges: WorkflowEdge[]) => void
  onNodesChange: OnNodesChange<WorkflowNode>
  onEdgesChange: OnEdgesChange<WorkflowEdge>
  onConnect: OnConnect
  setSelectedNode: (node: WorkflowNode | null) => void
  deleteNode: (nodeId: string) => void
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

export const createWorkflowSlice: StateCreator<WorkflowSlice> = (set, get) => ({
  workflows: [],
  currentWorkflow: null,
  nodes: [],
  edges: [],
  selectedNode: null,
  canvasZoom: 1,
  executionStates: {},
  executionStatus: null,
  isLoading: false,

  setWorkflows: (workflows) => set({ workflows }),
  
  setCurrentWorkflow: (workflow) => {
    if (workflow) {
      set({ currentWorkflow: workflow, nodes: workflow.nodes, edges: workflow.edges })
    } else {
      set({ currentWorkflow: null, nodes: [], edges: [] })
    }
  },
  
  setNodes: (nodes) => set({ nodes }),
  
  setEdges: (edges) => set({ edges }),

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

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    })
  },

  onConnect: (connection) => {
    set({
      edges: addEdge(connection, get().edges),
    })
  },
  
  setSelectedNode: (node) => set({ selectedNode: node }),

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
  
  setCanvasZoom: (zoom) => set({ canvasZoom: zoom }),
  
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
  
  runWorkflow: async (workflowId) => {
    set({ isLoading: true, executionStatus: 'running', executionStates: {} })
    try {
      const response = await request.post(`/workflows/${workflowId}/run`, { inputs: {} })
      set({ isLoading: false, executionStatus: 'success' })
      return response.data
    } catch (error) {
      set({ isLoading: false, executionStatus: 'failed' })
      throw error
    }
  },

  streamRunWorkflow: async (workflowId, inputs) => {
    set({ executionStatus: 'running', executionStates: {} })
    
    try {
      const response = await fetch(`/api/workflows/${workflowId}/run/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
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

  fetchWorkflows: async (appId) => {
    set({ isLoading: true })
    try {
      const response = await request.get(`/workflows/app/${appId}`) as any
      const workflows = (Array.isArray(response.data) ? response.data : []) as Workflow[]
      set({ workflows, isLoading: false })
      return workflows
    } catch (error) {
      set({ isLoading: false })
      set({ workflows: [] })
      throw error
    }
  },

  fetchWorkflowById: async (id) => {
    set({ isLoading: true })
    try {
      const response = await request.get(`/workflows/${id}`) as any
      const workflow = response.data as Workflow
      set({ currentWorkflow: workflow, nodes: workflow.nodes || [], edges: workflow.edges || [], isLoading: false })
      return workflow
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  createWorkflow: async (appId, data) => {
    set({ isLoading: true })
    try {
      const response = await request.post('/workflows', { ...data, applicationId: appId }) as any
      const workflow = response.data as Workflow
      const currentWorkflows = Array.isArray(get().workflows) ? get().workflows : []
      set({ workflows: [...currentWorkflows, workflow], isLoading: false })
      return workflow
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  updateWorkflow: async (id, data) => {
    set({ isLoading: true })
    try {
      const response = await request.patch(`/workflows/${id}`, data) as any
      const updatedWorkflow = response.data as Workflow
      const currentWorkflows = Array.isArray(get().workflows) ? get().workflows : []
      
      set({
        workflows: currentWorkflows.map((wf) => wf.id === id ? updatedWorkflow : wf),
        currentWorkflow: get().currentWorkflow?.id === id ? updatedWorkflow : get().currentWorkflow,
        isLoading: false,
      })
      
      return updatedWorkflow
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  saveWorkflow: async (id, data) => {
    set({ isLoading: true })
    try {
      const response = await request.patch(`/workflows/${id}`, data) as any
      const updatedWorkflow = response.data as Workflow
      set({ currentWorkflow: updatedWorkflow, isLoading: false })
      return updatedWorkflow
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  deleteWorkflow: async (id) => {
    set({ isLoading: true })
    try {
      await request.delete(`/workflows/${id}`)
      set({
        workflows: get().workflows.filter((wf) => wf.id !== id),
        currentWorkflow: get().currentWorkflow?.id === id ? null : get().currentWorkflow,
        isLoading: false,
      })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  clearExecutionStates: () => set({ executionStates: {} }),
})
