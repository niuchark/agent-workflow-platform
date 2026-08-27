import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useStore } from '../../store'

interface RequireAuthProps {
  children: ReactNode
}

/** 仅允许已登录用户访问受保护路由。 */
const RequireAuth = ({ children }: RequireAuthProps) => {
  const isAuthenticated = useStore((state) => state.isAuthenticated)

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}

export default RequireAuth
