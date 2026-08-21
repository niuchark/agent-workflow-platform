import type { User } from '../types'

const TOKEN_KEY = 'token'
const USER_KEY = 'user'

/**
 * 登录态统一持久化到 localStorage：
 * 登录后关闭浏览器再打开，仍然保持登录。
 */
export const getStoredToken = (): string | null => localStorage.getItem(TOKEN_KEY)

/** 读取缓存的用户信息（刷新页面后先展示，再通过 fetchProfile 校正）。 */
export const getStoredUser = (): User | null => {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

/** 登录成功时保存 token 与用户信息。 */
export const setStoredAuth = (token: string, user: User): void => {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

/** 更新缓存的用户信息。 */
export const setStoredUser = (user: User): void => {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

/** 清除登录态（同时清理旧版本可能残留在 sessionStorage 的数据）。 */
export const clearStoredAuth = (): void => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(USER_KEY)
}
