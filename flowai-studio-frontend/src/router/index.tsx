/**
 * 前端路由表：定义所有页面的访问路径与鉴权规则。
 *
 * - 公共路由：登录、注册、分享页，无需登录即可访问；
 * - 受保护路由：嵌套在 RequireAuth + Layout 下，未登录会重定向到 /login；
 * - 兜底路由：未匹配的地址统一回到首页。
 */
import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, createRoutesFromElements, Route, Navigate } from 'react-router-dom'
import Layout from '../components/layout/Layout'
import RequireAuth from '../components/routing/RequireAuth'
import RouteLoading from '../components/routing/RouteLoading'

const Login = lazy(() => import('../pages/Login'))
const Register = lazy(() => import('../pages/Register'))
const AppList = lazy(() => import('../pages/AppList'))
const AppEditor = lazy(() => import('../pages/AppEditor'))
const KnowledgeBase = lazy(() => import('../pages/KnowledgeBase'))
const Skill = lazy(() => import('../pages/Skill'))
const McpManager = lazy(() => import('../pages/McpManager'))
const TemplateMarket = lazy(() => import('../pages/TemplateMarket'))
const Debug = lazy(() => import('../pages/Debug'))
const TeamManagement = lazy(() => import('../pages/TeamManagement'))
const TeamDetail = lazy(() => import('../pages/TeamDetail'))
const ApiKeyManagement = lazy(() => import('../pages/ApiKeyManagement'))
const ModelSettings = lazy(() => import('../pages/ModelSettings'))
const SharedApp = lazy(() => import('../pages/SharedApp'))
const CostStatistics = lazy(() => import('../pages/CostStatistics'))
const RateLimitMonitor = lazy(() => import('../pages/RateLimitMonitor'))
const TraceList = lazy(() => import('../pages/TraceList'))
const TraceDetail = lazy(() => import('../pages/TraceDetail'))

/** 为每个页面分片提供一致且可访问的加载占位。 */
const lazyPage = (page: ReactNode) => (
  <Suspense fallback={<RouteLoading />}>
    {page}
  </Suspense>
)

/** 路由配置：集中登记公共路由、受保护路由与 404 兜底 */
export const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      {/* 公共路由 */}
      <Route path="/login" element={lazyPage(<Login />)} />
      <Route path="/register" element={lazyPage(<Register />)} />
      <Route path="/share/:shareLink" element={lazyPage(<SharedApp />)} />
      
      {/* 受保护路由 */}
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route path="/" element={<Navigate to="/apps" replace />} />
        <Route path="/apps" element={lazyPage(<AppList />)} />
        <Route path="/apps/:appId/editor" element={lazyPage(<AppEditor />)} />
        <Route path="/knowledge-bases" element={lazyPage(<KnowledgeBase />)} />
        <Route path="/tools" element={lazyPage(<Skill />)} />
        <Route path="/mcp" element={lazyPage(<McpManager />)} />
        <Route path="/templates" element={lazyPage(<TemplateMarket />)} />
        <Route path="/debug" element={lazyPage(<Debug />)} />
        <Route path="/teams" element={lazyPage(<TeamManagement />)} />
        <Route path="/teams/:teamId" element={lazyPage(<TeamDetail />)} />
        <Route path="/api-keys" element={lazyPage(<ApiKeyManagement />)} />
        <Route path="/model-settings" element={lazyPage(<ModelSettings />)} />
        <Route path="/cost-statistics" element={lazyPage(<CostStatistics />)} />
        <Route path="/rate-limit" element={lazyPage(<RateLimitMonitor />)} />
        <Route path="/trace-list" element={lazyPage(<TraceList />)} />
        <Route path="/trace-detail" element={lazyPage(<TraceDetail />)} />
      </Route>
      
      {/* 404路由 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </>
  )
)
