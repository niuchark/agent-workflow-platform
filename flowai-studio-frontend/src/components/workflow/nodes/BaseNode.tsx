/**
 * 节点基础外壳：所有画布节点的公共容器。
 *
 * 负责统一节点的宽度、内边距、左边框主题色、标题栏，
 * 并根据 store 中的执行状态显示运行中/成功/失败图标。
 */
import { memo, ReactNode } from 'react'
import { Spin, Typography } from 'antd'
import { LoadingOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { useStore } from '../../../store'

const { Text } = Typography

/** 基础节点 props */
interface BaseNodeProps {
  id: string
  label: string
  icon: ReactNode
  children?: ReactNode
  color?: string
  width?: number
}

/** 基础节点组件：渲染标题与状态图标，children 放连接点与摘要 */
const BaseNode = ({ id, label, icon, children, color = '#0284c7', width = 220 }: BaseNodeProps) => {
  // 从 store 读取该节点的执行状态，驱动状态图标
  const executionState = useStore((state) => state.executionStates[id])
  const status = executionState?.status || 'idle'

  /** 按执行状态返回对应图标 */
  const getStatusIcon = () => {
    switch (status) {
      case 'running':
        return <Spin indicator={<LoadingOutlined style={{ fontSize: 13 }} spin />} />
      case 'success':
        return <CheckCircleOutlined style={{ color: 'var(--c-green)' }} />
      case 'failed':
        return <ExclamationCircleOutlined style={{ color: 'var(--c-red)' }} />
      default:
        return null
    }
  }

  return (
    <div
      style={{
        width,
        padding: '12px 14px',
        borderLeft: `3px solid ${color}`,
        borderRadius: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: children ? 8 : 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color, fontSize: 15, display: 'flex' }}>{icon}</span>
          <Text strong style={{ fontSize: 13 }}>
            {label}
          </Text>
        </div>
        {getStatusIcon()}
      </div>
      {children}
    </div>
  )
}

export default memo(BaseNode)
