import { Spin } from 'antd'

/** 路由代码分片加载时保留稳定空间，并向辅助技术播报状态。 */
const RouteLoading = () => (
  <div
    className="flex min-h-[240px] items-center justify-center"
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <Spin size="large" />
    <span className="sr-only">正在加载页面…</span>
  </div>
)

export default RouteLoading
