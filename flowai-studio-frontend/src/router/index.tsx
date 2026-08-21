/**
 * 前端路由表：定义所有页面的访问路径与鉴权规则。
 *
 * - 公共路由：登录、注册、分享页，无需登录即可访问；
 * - 受保护路由：嵌套在 RequireAuth + Layout 下，未登录会重定向到 /login；
 * - 兜底路由：未匹配的地址统一回到首页。
 */
import { createBrowserRouter, createRoutesFromElements, Route, Navigate } from 'react-router-dom'
import Layout from '../components/layout/Layout'
import Login from '../pages/Login'
import Register from '../pages/Register'
import AppList from '../pages/AppList'
import AppEditor from '../pages/AppEditor'
import KnowledgeBase from '../pages/KnowledgeBase'
import Skill from '../pages/Skill'
import McpManager from '../pages/McpManager'
import TemplateMarket from '../pages/TemplateMarket'
import Debug from '../pages/Debug'
import TeamManagement from '../pages/TeamManagement'
import TeamDetail from '../pages/TeamDetail'
import ApiKeyManagement from '../pages/ApiKeyManagement'
import ModelSettings from '../pages/ModelSettings'
import SharedApp from '../pages/SharedApp'
import CostStatistics from '../pages/CostStatistics'
import RateLimitMonitor from '../pages/RateLimitMonitor'
import TraceList from '../pages/TraceList'
import TraceDetail from '../pages/TraceDetail'
import { useStore } from '../store'

/** 鉴权守卫：未登录时重定向到登录页，已登录才渲染子页面 */
const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useStore()
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  return children
}

/** 路由配置：集中登记公共路由、受保护路由与 404 兜底 */
export const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      {/* 公共路由 */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/share/:shareLink" element={<SharedApp />} />
      
      {/* 受保护路由 */}
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route path="/" element={<Navigate to="/apps" replace />} />
        <Route path="/apps" element={<AppList />} />
        <Route path="/apps/:appId/editor" element={<AppEditor />} />
        <Route path="/knowledge-bases" element={<KnowledgeBase />} />
        <Route path="/tools" element={<Skill />} />
        <Route path="/mcp" element={<McpManager />} />
        <Route path="/templates" element={<TemplateMarket />} />
        <Route path="/debug" element={<Debug />} />
        <Route path="/teams" element={<TeamManagement />} />
        <Route path="/teams/:teamId" element={<TeamDetail />} />
        <Route path="/api-keys" element={<ApiKeyManagement />} />
        <Route path="/model-settings" element={<ModelSettings />} />
        <Route path="/cost-statistics" element={<CostStatistics />} />
        <Route path="/rate-limit" element={<RateLimitMonitor />} />
        <Route path="/trace-list" element={<TraceList />} />
        <Route path="/trace-detail" element={<TraceDetail />} />
      </Route>
      
      {/* 404路由 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </>
  )
)
