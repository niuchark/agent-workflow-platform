/**
 * 全局 Axios 实例：统一管理 API 请求的前缀、鉴权与错误处理。
 *
 * - baseURL 为 /api，配合 Vite 代理转发到后端；
 * - 请求拦截器自动附加 Bearer token，并支持 cacheBust 时间戳防缓存；
 * - 响应拦截器直接返回 data，并把各种 HTTP 错误统一改写为可读的中文提示。
 */
import axios from 'axios'
import { clearStoredAuth, getStoredToken } from './authStorage'

/** 从 Axios 响应中取出 data 字段（兼容响应拦截器已解包的情况） */
export const getResponseData = <T>(response: unknown): T =>
  (response as { data: T }).data

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** 兼容后端对象、字符串及 message 数组错误体，避免错误处理器再次抛错。 */
const getErrorMessage = (data: unknown): string | undefined => {
  if (typeof data === 'string') return data
  if (!isRecord(data)) return undefined

  const message = data.message
  if (typeof message === 'string') return message
  if (Array.isArray(message)) {
    const parts = message.filter((item): item is string => typeof item === 'string')
    return parts.length > 0 ? parts.join('；') : undefined
  }
  return undefined
}

/** 扩展 Axios 配置类型：允许在请求里声明 cacheBust（GET 防缓存） */
declare module 'axios' {
  interface AxiosRequestConfig {
    cacheBust?: boolean
  }
}

// 创建axios实例
const request = axios.create({
  baseURL: '/api', // 基础URL，与Vite配置对应
  timeout: 15000, // 请求超时时间
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    // 从 authStorage 获取 token（登录后始终持久化在 localStorage）
    const token = getStoredToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    // 仅对显式声明的 GET 请求追加时间戳，避免与后端严格 DTO 校验冲突
    if (config.cacheBust && config.method?.toLowerCase() === 'get') {
      config.params = {
        ...config.params,
        _t: Date.now(),
      }
    }
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
request.interceptors.response.use(
  (response) => {
    // 只返回data部分
    return response.data
  },
  (error) => {
    // 处理错误响应
    if (error.response) {
      // 服务器返回错误状态码
      const { status, data } = error.response
      const responseMessage = getErrorMessage(data)
      
      switch (status) {
        case 400:
          // 请求参数错误
          error.message = responseMessage || '请求参数错误'
          break
        
        case 401:
          // 未授权：清除登录态，并派发事件由应用内登出（路由守卫会自动跳回登录页）
          clearStoredAuth()
          // 登录接口自身的 401（密码错误/账号锁定）由登录页展示错误，不触发全局登出
          if (!error.config?.url?.includes('/users/login')) {
            window.dispatchEvent(new Event('auth:unauthorized'))
          }
          error.message = responseMessage || '登录已过期，请重新登录'
          break
        
        case 403:
          // 禁止访问
          error.message = responseMessage || '没有权限访问该资源'
          break
        
        case 404:
          // 资源不存在
          error.message = responseMessage || '请求的资源不存在'
          break
        
        case 409:
          // 资源冲突
          error.message = responseMessage || '资源已存在'
          break
        
        case 429:
          // 请求过于频繁
          error.message = responseMessage || '请求过于频繁，请稍后重试'
          break
        
        case 500:
          // 服务器内部错误
          error.message = responseMessage || '服务器内部错误，请稍后重试'
          break
        
        case 502:
          // 网关错误
          error.message = responseMessage || '网关错误，请稍后重试'
          break
        
        case 503:
          // 服务不可用
          error.message = responseMessage || '服务暂时不可用，请稍后重试'
          break
        
        default:
          // 其他错误
          error.message = responseMessage || `请求失败 (${status})`
      }
    } else if (error.request) {
      // 请求已发出但没有收到响应
      if (error.code === 'ECONNABORTED') {
        error.message = '请求超时，请检查网络连接'
      } else {
        error.message = '网络错误，请检查网络连接'
      }
    } else {
      // 请求配置出错
      error.message = `请求错误: ${error.message}`
    }
    
    // 统一错误格式
    error.response = error.response || {}
    const responseData = isRecord(error.response.data) ? error.response.data : {}
    error.response.data = { ...responseData, message: error.message }
    
    return Promise.reject(error)
  }
)

export default request
