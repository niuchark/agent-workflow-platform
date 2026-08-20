import { useState, useEffect, useRef } from 'react'
import { Button, message, Tag, Tooltip, Dropdown, Modal } from 'antd'
import {
  SaveOutlined,
  PlayCircleOutlined,
  ArrowLeftOutlined,
  AppstoreOutlined,
  BugOutlined,
  SettingOutlined,
  ShareAltOutlined,
  ExportOutlined,
  FileTextOutlined,
  FileMarkdownOutlined,
  CloseOutlined,
  DeleteOutlined,
  PlusSquareOutlined,
} from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { exportWorkflowDsl } from '../utils/workflowDslApi'
import { ReactFlowProvider } from '@xyflow/react'
import WorkflowCanvas from '../components/workflow/WorkflowCanvas'
import NodePanel from '../components/workflow/NodePanel'
import ConfigPanel from '../components/workflow/ConfigPanel'
import RunPanel from '../components/workflow/RunPanel'
import AppShareSettings from '../components/AppShareSettings'

type RightPanel = 'config' | 'debug' | 'share'

const RIGHT_PANELS = [
  { key: 'config', label: '配置', icon: SettingOutlined },
  { key: 'debug', label: '调试', icon: BugOutlined },
  { key: 'share', label: '分享', icon: ShareAltOutlined },
] satisfies Array<{ key: RightPanel; label: string; icon: React.ComponentType }>

const STATUS_TAGS: Record<string, { color: string; label: string }> = {
  running: { color: 'processing', label: '运行中' },
  success: { color: 'success', label: '成功' },
  failed: { color: 'error', label: '失败' },
  stopped: { color: 'default', label: '已停止' },
}

const DEFAULT_PANEL_WIDTH = 360
const MIN_PANEL_WIDTH = 300
const MAX_PANEL_WIDTH = 560
const DEFAULT_NODE_PANEL_WIDTH = 176
const MIN_NODE_PANEL_WIDTH = 120
const MAX_NODE_PANEL_WIDTH = 300
const EDITOR_DESKTOP_MEDIA_QUERY = '(min-width: 1024px)'

const clampPanelWidth = (width: number) => Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, width))
const clampNodePanelWidth = (width: number) => Math.min(MAX_NODE_PANEL_WIDTH, Math.max(MIN_NODE_PANEL_WIDTH, width))

const AppEditor: React.FC = () => {
  const { appId } = useParams<{ appId: string }>()
  const navigate = useNavigate()
  const [modal, modalContextHolder] = Modal.useModal()
  const [messageApi, messageContextHolder] = message.useMessage()
  const {
    currentApp,
    fetchAppById,
    currentWorkflow,
    fetchWorkflows,
    fetchWorkflowById,
    createWorkflow,
    nodes,
    edges,
    isLoading,
    saveWorkflow,
    executionStatus,
    selectedNode,
    deleteNode,
  } = useStore()

  const [rightPanel, setRightPanel] = useState<RightPanel>('config')
  const [isCompactViewport, setIsCompactViewport] = useState(() =>
    typeof window !== 'undefined' && !window.matchMedia(EDITOR_DESKTOP_MEDIA_QUERY).matches
  )
  const [isPanelOpen, setIsPanelOpen] = useState(() =>
    typeof window === 'undefined' || window.matchMedia(EDITOR_DESKTOP_MEDIA_QUERY).matches
  )
  const [isNodePanelOpen, setIsNodePanelOpen] = useState(false)
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH)
  const [nodePanelWidth, setNodePanelWidth] = useState(DEFAULT_NODE_PANEL_WIDTH)

  // 使用 ref 防止 React StrictMode 下 useEffect 重复执行导致弹两次错误
  const initRef = useRef(false)

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    const initEditor = async () => {
      if (!appId) return
      try {
        await fetchAppById(appId)
        const workflows = await fetchWorkflows(appId)

        if (workflows && workflows.length > 0) {
          await fetchWorkflowById(workflows[0].id)
        } else {
          // 新建空白工作流
          const createdWorkflow = await createWorkflow(appId, {
            name: '默认工作流',
            description: '自动创建的默认工作流',
          })
          await fetchWorkflowById(createdWorkflow.id)
        }
      } catch {
        messageApi.error('初始化编辑器失败')
      }
    }
    initEditor()
  }, [appId, createWorkflow, fetchAppById, fetchWorkflowById, fetchWorkflows, messageApi])

  useEffect(() => {
    const mediaQuery = window.matchMedia(EDITOR_DESKTOP_MEDIA_QUERY)
    const handleViewportChange = (event: MediaQueryListEvent) => {
      setIsCompactViewport(!event.matches)
      setIsNodePanelOpen(false)
      setIsPanelOpen(event.matches)
    }

    mediaQuery.addEventListener('change', handleViewportChange)
    return () => mediaQuery.removeEventListener('change', handleViewportChange)
  }, [])

  const handleSave = async () => {
    const workflowId = currentWorkflow?.id
    if (!workflowId) {
      messageApi.error('未找到有效的工作流')
      return
    }
    try {
      await saveWorkflow(workflowId, { nodes, edges })
      messageApi.success('工作流保存成功')
    } catch {
      messageApi.error('保存失败，请重试')
    }
  }

  const handleRun = () => {
    handlePanelSelect('debug')
  }

  const handlePanelSelect = (panel: RightPanel) => {
    setRightPanel(panel)
    setIsPanelOpen(true)
    setIsNodePanelOpen(false)
  }

  const handleNodePanelToggle = () => {
    const nextIsOpen = !isNodePanelOpen
    setIsNodePanelOpen(nextIsOpen)
    if (nextIsOpen) setIsPanelOpen(false)
  }

  const handleMobilePanelDismiss = () => {
    setIsNodePanelOpen(false)
  }

  const handleCanvasNodeSelect = () => {
    handlePanelSelect('config')
  }

  const handleDeleteSelectedNode = () => {
    if (!selectedNode) return
    const nodeName = String(selectedNode.data?.label || '未命名节点')

    modal.confirm({
      title: `删除节点「${nodeName}」？`,
      content: '与该节点相连的连线也会一并删除。保存工作流前仍可通过重新加载页面放弃本次修改。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        deleteNode(selectedNode.id)
        messageApi.success(`已删除节点「${nodeName}」`)
      },
    })
  }

  const startHorizontalResize = (
    event: React.PointerEvent<HTMLDivElement>,
    startWidth: number,
    direction: 1 | -1,
    updateWidth: (width: number) => void,
    clampWidth: (width: number) => number
  ) => {
    event.preventDefault()
    const startX = event.clientX

    const handlePointerMove = (moveEvent: PointerEvent) => {
      updateWidth(clampWidth(startWidth + (moveEvent.clientX - startX) * direction))
    }

    const handlePointerUp = () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
      document.body.classList.remove('is-resizing-panel')
    }

    document.body.classList.add('is-resizing-panel')
    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)
  }

  const handleResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    startHorizontalResize(event, panelWidth, -1, setPanelWidth, clampPanelWidth)
  }

  const handleResizeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setPanelWidth((width) => clampPanelWidth(width + 16))
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      setPanelWidth((width) => clampPanelWidth(width - 16))
    }
  }

  const handleNodePanelResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    startHorizontalResize(event, nodePanelWidth, 1, setNodePanelWidth, clampNodePanelWidth)
  }

  const handleNodePanelResizeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setNodePanelWidth((width) => clampNodePanelWidth(width - 16))
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      setNodePanelWidth((width) => clampNodePanelWidth(width + 16))
    }
  }

  const handleExport = async (format: 'yaml' | 'json') => {
    const workflowId = currentWorkflow?.id
    if (!workflowId) {
      messageApi.error('未找到有效的工作流')
      return
    }
    try {
      const blob = await exportWorkflowDsl(workflowId, format)
      const ext = format === 'yaml' ? 'yaml' : 'json'
      const fileName = `${currentApp?.name || 'workflow'}-${currentWorkflow?.name || 'untitled'}.${ext}`

      // 创建下载链接
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      messageApi.success(`已导出为 ${format.toUpperCase()} 格式`)
    } catch {
      messageApi.error('导出失败，请重试')
    }
  }

  const tag = executionStatus ? STATUS_TAGS[executionStatus] : null

  return (
    <>
      {modalContextHolder}
      {messageContextHolder}
      <div className="editor-root">
      {/* ---- Top bar ---- */}
      <header className="editor-topbar">
        <div className="editor-topbar-left">
          <Tooltip title="返回应用列表">
            <button className="editor-back-btn" onClick={() => navigate('/apps')}>
              <ArrowLeftOutlined />
            </button>
          </Tooltip>
          <div className="editor-topbar-divider" />
          <div className="editor-app-info">
            <span className="editor-app-icon">
              <AppstoreOutlined />
            </span>
            <span className="editor-app-name">{currentApp?.name || '应用编辑器'}</span>
            {tag && <Tag color={tag.color}>{tag.label}</Tag>}
          </div>
        </div>

        <div className="editor-topbar-center">
          <div className="editor-panel-tabs" role="tablist" aria-label="编辑器侧边面板">
            {RIGHT_PANELS.map(({ key, label, icon: Icon }) => {
              const isActive = isPanelOpen && rightPanel === key
              return (
                <button
                  key={key}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls="editor-inspector"
                  className={`editor-panel-tab ${isActive ? 'editor-panel-tab--active' : ''}`}
                  onClick={() => handlePanelSelect(key)}
                >
                  <Icon /> {label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="editor-topbar-right">
          {selectedNode && (
            <Tooltip title="删除所选节点（Delete / Backspace）">
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={handleDeleteSelectedNode}
                className="editor-action-btn editor-delete-node-btn"
                aria-label="删除所选节点"
              />
            </Tooltip>
          )}
          <Dropdown
            menu={{
              items: [
                {
                  key: 'yaml',
                  label: '导出为 YAML',
                  icon: <FileTextOutlined />,
                  onClick: () => handleExport('yaml'),
                },
                {
                  key: 'json',
                  label: '导出为 JSON',
                  icon: <FileMarkdownOutlined />,
                  onClick: () => handleExport('json'),
                },
              ],
            }}
          >
            <Button
              size="small"
              icon={<ExportOutlined />}
              className="editor-action-btn"
              aria-label="导出工作流"
            >
              <span className="editor-action-label">导出</span>
            </Button>
          </Dropdown>
          <Button
            size="small"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={isLoading}
            className="editor-action-btn"
            aria-label="保存工作流"
          >
            <span className="editor-action-label">保存</span>
          </Button>
          <Button
            size="small"
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={handleRun}
            className="editor-action-btn"
            aria-label="运行工作流"
          >
            <span className="editor-action-label">运行</span>
          </Button>
        </div>
      </header>

      {/* ---- Editor body ---- */}
      <ReactFlowProvider>
        <div className="editor-body">
          {isNodePanelOpen && (
            <button
              type="button"
              className="editor-panel-scrim"
              onClick={handleMobilePanelDismiss}
              aria-label="关闭节点库"
            />
          )}
          <aside
            id="editor-node-library"
            className={`editor-node-panel-shell ${isNodePanelOpen ? 'editor-node-panel-shell--mobile-open' : ''}`}
            style={{ width: nodePanelWidth }}
            aria-label="节点库"
            aria-hidden={isCompactViewport && !isNodePanelOpen}
          >
            <NodePanel />
            <Tooltip title="关闭节点库">
              <button
                type="button"
                className="editor-node-panel-close"
                onClick={() => setIsNodePanelOpen(false)}
                aria-label="关闭节点库"
              >
                <CloseOutlined aria-hidden="true" />
              </button>
            </Tooltip>
            <div
              className="editor-node-panel-resizer"
              role="separator"
              aria-label="调整节点库宽度"
              aria-orientation="vertical"
              aria-valuemin={MIN_NODE_PANEL_WIDTH}
              aria-valuemax={MAX_NODE_PANEL_WIDTH}
              aria-valuenow={nodePanelWidth}
              title="拖动调整宽度，双击恢复默认宽度"
              tabIndex={0}
              onPointerDown={handleNodePanelResizeStart}
              onKeyDown={handleNodePanelResizeKeyDown}
              onDoubleClick={() => setNodePanelWidth(DEFAULT_NODE_PANEL_WIDTH)}
            />
          </aside>
          <div className="editor-canvas-wrapper">
            <WorkflowCanvas onNodeSelect={handleCanvasNodeSelect} />
          </div>
          {isPanelOpen && (
            <aside
              id="editor-inspector"
              className="editor-inspector"
              style={{ width: panelWidth }}
              aria-label={`${rightPanel === 'config' ? '配置' : rightPanel === 'debug' ? '调试' : '分享'}面板`}
            >
              <div
                className="editor-inspector-resizer"
                role="separator"
                aria-label="调整侧边面板宽度"
                aria-orientation="vertical"
                aria-valuemin={MIN_PANEL_WIDTH}
                aria-valuemax={MAX_PANEL_WIDTH}
                aria-valuenow={panelWidth}
                title="拖动调整宽度，双击恢复默认宽度"
                tabIndex={0}
                onPointerDown={handleResizeStart}
                onKeyDown={handleResizeKeyDown}
                onDoubleClick={() => setPanelWidth(DEFAULT_PANEL_WIDTH)}
              />
              <Tooltip title="关闭侧边面板">
                <button
                  type="button"
                  className="editor-inspector-close"
                  onClick={() => setIsPanelOpen(false)}
                  aria-label="关闭侧边面板"
                >
                  <CloseOutlined />
                </button>
              </Tooltip>
              <div className="editor-inspector-content">
                {rightPanel === 'config' ? <ConfigPanel /> : rightPanel === 'debug' ? <RunPanel /> : (
                  <div className="editor-share-panel">
                    <AppShareSettings appId={appId!} />
                  </div>
                )}
              </div>
            </aside>
          )}
          <nav className="editor-mobile-toolbar" aria-label="编辑器面板">
            <button
              type="button"
              className={`editor-mobile-toolbar-btn ${isNodePanelOpen ? 'editor-mobile-toolbar-btn--active' : ''}`}
              onClick={handleNodePanelToggle}
              aria-controls="editor-node-library"
              aria-expanded={isNodePanelOpen}
            >
              <PlusSquareOutlined aria-hidden="true" />
              <span>节点</span>
            </button>
            <div className="editor-mobile-panel-actions">
              {RIGHT_PANELS.map(({ key, label, icon: Icon }) => {
                const isActive = isPanelOpen && rightPanel === key
                return (
                  <button
                    key={key}
                    type="button"
                    className={`editor-mobile-toolbar-btn ${isActive ? 'editor-mobile-toolbar-btn--active' : ''}`}
                    onClick={() => handlePanelSelect(key)}
                    aria-controls="editor-inspector"
                    aria-expanded={isActive}
                  >
                    <Icon aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                )
              })}
            </div>
          </nav>
        </div>
      </ReactFlowProvider>
      </div>
    </>
  )
}

export default AppEditor
