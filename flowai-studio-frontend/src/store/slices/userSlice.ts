/**
 * 用户状态切片：管理登录/注册/退出/资料拉取及鉴权错误。
 *
 * token 与 user 由 authStorage 统一管理，登录后始终写入
 * localStorage：刷新页面或重开浏览器都保持登录；
 * 所有接口错误统一通过 parseAuthError 归一化为 AuthError，供表单展示。
 */
import { StateCreator } from 'zustand'
import axios from 'axios'
import { User, LoginForm, RegisterForm } from '../../types'
import request, { getResponseData } from '../../utils/axios'
import { clearStoredAuth, getStoredToken, getStoredUser, setStoredAuth, setStoredUser } from '../../utils/authStorage'

/** 鉴权错误类型：按错误来源区分，便于表单给出针对性提示 */
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

export const createUserSlice: StateCreator<UserSlice> = (set, get) => {
  const initialToken = getStoredToken()

  return {
    user: getStoredUser(),
    token: initialToken,
    isAuthenticated: !!initialToken,
    isLoading: false,
    authError: null,

    setUser: (user) => set({ user }),

    setIsAuthenticated: (value) => set({ isAuthenticated: value }),

    setAuthError: (authError) => set({ authError }),

    clearError: () => set({ authError: null }),

    /** 登录成功时：调用后端接口，持久化登录态并更新状态 */
    login: async (data) => {
      set({ isLoading: true, authError: null })

      try {
        const { user, token } = getResponseData<{ user: User; token: string }>(
          await request.post('/users/login', data),
        )

        // 登录后始终持久化到 localStorage（关闭浏览器再打开仍保持登录）
        setStoredAuth(token, user)

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

    /** 注册成功：仅提示并回到登录页，不自动登录 */
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

    /** 退出登录：清空存储中的 token 与 user，并重置登录态 */
    logout: () => {
      clearStoredAuth()
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        authError: null
      })
    },

    /** 拉取个人资料：成功则刷新缓存；token 失效（401）时自动登出 */
    fetchProfile: async () => {
      try {
        const user = getResponseData<User>(await request.get('/users/profile'))
        // 同步刷新缓存的用户信息
        setStoredUser(user)
        set({ user })
      } catch (error) {
        // 仅 token 失效（401）时登出；网络/服务器错误不应把已登录用户踢下线
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          get().logout()
        }
        throw error
      }
    },
  }
}
