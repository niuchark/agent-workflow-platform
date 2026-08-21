/**
 * 登录/注册表单校验规则：集中定义用户名与密码的合法性约束。
 *
 * 规则供 Ant Design Form 直接消费，保证登录、注册等页面
 * 的校验文案完全一致。
 */
import type { Rule } from 'antd/es/form'

/** 用户名输入框占位提示 */
export const USERNAME_PLACEHOLDER = '3–20 位英文、数字或下划线'

/** 用户名校验规则：必填、3–20 位，且只允许英文/数字/下划线 */
export const USERNAME_RULES: Rule[] = [
  { required: true, message: '请输入用户名' },
  { min: 3, message: '用户名长度不足：至少需要 3 位' },
  { max: 20, message: '用户名过长：最多允许 20 位' },
  {
    pattern: /^[a-zA-Z0-9_]+$/,
    message: '用户名包含不支持的字符：不能使用中文、空格或特殊符号',
  },
]

/** 密码校验规则：必填且至少 6 位 */
export const PASSWORD_RULES: Rule[] = [
  { required: true, message: '请输入密码' },
  { min: 6, message: '密码长度不足：至少需要 6 位字符' },
]
