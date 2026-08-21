/**
 * 调试运行面板：输入 JSON 参数并流式运行当前工作流。
 *
 * 运行过程通过 SSE 逐节点更新 executionStates，面板展示
 * 每个节点的状态、输出与错误；支持停止（仅本地置状态）与清空结果。
 */
import { useState } from 'react'
import { Button, Input, Empty } from 'antd'
import {
  PlayCircleOutlined,
  StopOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  ClockCircleOutlined,
  ClearOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons'
import { useStore } from '../../store'

const { TextArea } = Input

/** 调试运行面板组件 */
const RunPanel: React.FC = () => {
  const {
    currentWorkflow,
    nodes,
    executionStates,
    executionStatus,
    streamRunWorkflow,
    setExecutionStatus,
    clearExecutionStates,
  } = useStore()

  // 默认示例输入，方便用户直接点击运行
  const [inputsText, setInputsText] = useState('{"question": "你好，请介绍一下自己"}')
  const [isRunning, setIsRunning] = useState(false)

  /** 运行工作流：解析 JSON 输入后调用流式运行 */
  const handleRun = async () => {
    const workflowId = currentWorkflow?.id
    if (!workflowId) return

    let inputs: Record<string, any> = {}
    // 输入解析失败时按空对象继续运行
    try {
      inputs = JSON.parse(inputsText)
    } catch {
      // Keep empty
    }

    setIsRunning(true)
    try {
      await streamRunWorkflow(workflowId, inputs)
    } catch {
      // Error handled in store
    } finally {
      setIsRunning(false)
    }
  }

  /** 停止运行：仅把本地状态置为已停止 */
  const handleStop = () => {
    setIsRunning(false)
    setExecutionStatus('stopped')
  }

  /** 清空所有节点执行结果与整体状态 */
  const handleClear = () => {
    clearExecutionStates()
    setExecutionStatus(null)
  }

  /** 按状态映射对应的图标与颜色 */
  const statusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <LoadingOutlined spin style={{ color: 'var(--c-blue)' }} />
      case 'success':
        return <CheckCircleOutlined style={{ color: 'var(--c-green)' }} />
      case 'failed':
        return <CloseCircleOutlined style={{ color: 'var(--c-red)' }} />
      case 'skipped':
        return <MinusCircleOutlined style={{ color: 'var(--c-text-tertiary)' }} />
      default:
        return <ClockCircleOutlined style={{ color: 'var(--c-text-tertiary)' }} />
    }
  }

  const executedNodes = Object.values(executionStates)
  const hasResults = executedNodes.length > 0

  return (
    <div className="run-panel">
      <div className="run-panel-header">
        <h3>调试运行</h3>
      </div>

      <div className="run-panel-body">
        {/* Input section */}
        <div className="run-section">
          <label className="run-section-label">输入参数 (JSON)</label>
          <TextArea
            value={inputsText}
            onChange={(e) => setInputsText(e.target.value)}
            placeholder='{"question": "你好"}'
            rows={4}
            className="run-input-textarea"
            disabled={isRunning}
          />
        </div>

        {/* Action buttons */}
        <div className="run-actions">
          {isRunning ? (
            <Button
              danger
              icon={<StopOutlined />}
              onClick={handleStop}
              block
              size="middle"
            >
              停止
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleRun}
              block
              size="middle"
            >
              运行工作流
            </Button>
          )}
          {hasResults && !isRunning && (
            <Button
              icon={<ClearOutlined />}
              onClick={handleClear}
              size="middle"
              className="run-clear-btn"
            >
              清除
            </Button>
          )}
        </div>

        {/* Execution status */}
        {executionStatus && (
          <div className={`run-status run-status--${executionStatus}`}>
            {statusIcon(executionStatus)}
            <span>
              {executionStatus === 'running'
                ? '运行中…'
                : executionStatus === 'success'
                ? '执行完成'
                : executionStatus === 'failed'
                ? '执行失败'
                : '已停止'}
            </span>
          </div>
        )}

        {/* Node results */}
        {hasResults ? (
          <div className="run-results">
            <label className="run-section-label">节点执行结果</label>
            {executedNodes.map((exec) => {
              const node = nodes.find((n) => n.id === exec.nodeId)
              return (
                <div key={exec.nodeId} className="run-result-card">
                  <div className="run-result-header">
                    {statusIcon(exec.status)}
                    <span className="run-result-name">
                      {(node?.data as any)?.label || exec.nodeId}
                    </span>
                    <span className="run-result-type">{node?.type}</span>
                  </div>
                  {(exec as any).output && (
                    <pre className="run-result-output">
                      {typeof (exec as any).output === 'string'
                        ? (exec as any).output
                        : JSON.stringify((exec as any).output, null, 2)}
                    </pre>
                  )}
                  {exec.error && (
                    <div className="run-result-error">{exec.error}</div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          !isRunning && (
            <div className="run-empty">
              <Empty
                description="点击「运行工作流」开始调试"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </div>
          )
        )}
      </div>
    </div>
  )
}

export default RunPanel
