/**
 * 应用根组件：负责挂载路由，并处理全局鉴权生命周期。
 *
 * - 监听 axios 拦截器派发的 auth:unauthorized 事件，统一登出；
 * - 应用启动时静默校验 token 并刷新用户信息。
 */
import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { useStore } from './store'

/** 根组件：将路由实例交给 RouterProvider 渲染 */
function App() {
  const { isAuthenticated, fetchProfile, logout } = useStore()

  // token 失效（401）时由 axios 拦截器触发，清空登录态；
  // 受保护路由检测到未登录会自动重定向到登录页（SPA 内跳转，不再整页刷新）。
  useEffect(() => {
    window.addEventListener('auth:unauthorized', logout)
    return () => window.removeEventListener('auth:unauthorized', logout)
  }, [logout])

  // 应用启动时静默校验 token 并刷新用户信息：
  // token 过期时后端返回 401，会自动登出并回到登录页。
  useEffect(() => {
    if (isAuthenticated) {
      fetchProfile().catch(() => {})
    }
  }, [isAuthenticated, fetchProfile])

  return <RouterProvider router={router} />
}

export default App
