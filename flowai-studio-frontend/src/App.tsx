/**
 * 应用根组件：负责挂载路由。
 *
 * 整个前端只有这一个入口组件，实际页面切换由 router 中的
 * 路由表（含登录鉴权守卫）控制。
 */
import { RouterProvider } from 'react-router-dom'
import { router } from './router'

/** 根组件：将路由实例交给 RouterProvider 渲染 */
function App() {
  return <RouterProvider router={router} />
}

export default App
