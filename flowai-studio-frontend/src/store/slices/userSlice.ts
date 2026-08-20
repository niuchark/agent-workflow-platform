import { StateCreator } from 'zustand'
import axios from 'axios'
import { User, LoginForm, RegisterForm } from '../../types'
import request, { getResponseData } from '../../utils/axios'

// 错误类型定义
interface AuthError {
  type: 'VALIDATION' | 'AUTHENTICATION' | 'NETWORK' | 'SERVER' | 'LOCKED';
  message: string;
}

export type UserError = AuthError

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

/**
 * 解析错误信息
 */
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

export const createUserSlice: StateCreator<UserSlice> = (set, get) => ({
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  isLoading: false,
  authError: null,

  setUser: (user) => set({ user }),
  
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
