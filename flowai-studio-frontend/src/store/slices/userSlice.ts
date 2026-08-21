/**
 * 用户状态切片：管理登录/注册/退出/资料拉取及鉴权错误。
 *
 * token 与 user 会同步写入 localStorage，页面刷新后仍可恢复会话；
 * 所有接口错误统一通过 parseAuthError 归一化为 AuthError，供表单展示。
 */
import { StateCreator } from 'zustand'
import axios from 'axios'
import { User, LoginForm, RegisterForm } from '../../types'
import request, { getResponseData } from '../../utils/axios'

/** 鉴权错误类型：按错误来源区分，便于表单给出针对性提示 */
interface AuthError {
  type: 'VALIDATION' | 'AUTHENTICATION' | 'NETWORK' | 'SERVER' | 'LOCKED';
  message: string;
}

export type UserError = AuthError

/** 用户切片对外暴露的状态与 Actions 类型 */
export interface UserSlice {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  authError: UserError | null
  
  // Actions
  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
  setIsAuthenticated: (value: boolean) => void
  setAuthError: (error: UserError | null) => void
  clearError: () => void
  login: (data: LoginForm) => Promise<void>
  register: (data: RegisterForm) => Promise<void>
  logout: () => void
  fetchProfile: () => Promise<void>
}

/** 把接口异常统一解析为 AuthError，按 HTTP 状态码映射错误类型与提示文案 */
const parseAuthError = (error: unknown): AuthError => {
  if (error instanceof Error && !axios.isAxiosError(error)) {
    return { type: 'VALIDATION', message: error.message }
  }

  if (!axios.isAxiosError(error) || !error.response) {
    return {
      type: 'NETWORK',
      message: '网络连接失败，请检查网络设置'
    };
  }

  const { status } = error.response;
  const responseData = error.response.data as { message?: string | string[] }
  const message = Array.isArray(responseData?.message)
    ? responseData.message.join('；')
    : responseData?.message
  
  switch (status) {
    case 400:
      return {
        type: 'VALIDATION',
        message: message || '请求参数错误'
      };
    
    case 401:
      // 检查是否为账户锁定
      if (message?.includes('锁定')) {
        return {
          type: 'LOCKED',
          message
        };
      }
      return {
        type: 'AUTHENTICATION',
        message: message || '用户名或密码错误'
      };
    
    case 409:
      return {
        type: 'VALIDATION',
        message: message || '用户名已存在'
      };
    
    case 500:
      return {
        type: 'SERVER',
        message: '服务器内部错误，请稍后重试'
      };
    
    default:
      return {
        type: 'SERVER',
        message: message || '未知错误，请稍后重试'
      };
  }
};

/** 创建用户切片：提供会话状态与登录/注册/登出/拉取资料等操作 */
export const createUserSlice: StateCreator<UserSlice> = (set, get) => ({
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  isLoading: false,
  authError: null,

  setUser: (user) => set({ user }),
  
  /** 设置 token：同步写入/清除 localStorage，并更新登录态 */
  setToken: (token) => {
    if (token) {
      localStorage.setItem('token', token)
    } else {
      localStorage.removeItem('token')
    }
    set({ token, isAuthenticated: !!token })
  },
  
  setIsAuthenticated: (value) => set({ isAuthenticated: value }),

  setAuthError: (authError) => set({ authError }),

  clearError: () => set({ authError: null }),

  /** 登录：调用登录接口，成功后保存 token 与用户信息到本地存储 */
  login: async (data) => {
    set({ isLoading: true, authError: null })
    
    try {
      const { user, token } = getResponseData<{ user: User; token: string }>(
        await request.post('/users/login', data),
      )
      
      // 保存到本地存储
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
      
      set({ 
        user, 
        token, 
        isAuthenticated: true, 
        isLoading: false, 
        authError: null 
      })
    } catch (error: unknown) {
      const loginError = parseAuthError(error)
      
      set({ 
        isLoading: false, 
        authError: loginError 
      })
      
      throw loginError
    }
  },

  /** 注册：调用注册接口，成功后仅清除加载态（登录由用户手动完成） */
  register: async (data) => {
    set({ isLoading: true, authError: null })
    
    try {
      await request.post('/users/register', data)
      set({ isLoading: false, authError: null })
    } catch (error: unknown) {
      const loginError = parseAuthError(error)
      
      set({ 
        isLoading: false, 
        authError: loginError 
      })
      
      throw loginError
    }
  },

  /** 退出登录：清除本地存储与内存中的会话状态 */
  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    set({ 
      user: null, 
      token: null, 
      isAuthenticated: false, 
      authError: null 
    })
  },

  /** 拉取当前用户资料；失败（如 token 失效）则自动登出 */
  fetchProfile: async () => {
    try {
      const user = getResponseData<User>(await request.get('/users/profile'))
      localStorage.setItem('user', JSON.stringify(user))
      set({ user })
    } catch (error) {
      get().logout()
      throw error
    }
  },
})
