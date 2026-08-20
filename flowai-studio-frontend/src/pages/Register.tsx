import { useState } from 'react'
import { Form, Input, Button, Alert, message } from 'antd'
import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { useNavigate, Link } from 'react-router-dom'
import { useStore } from '../store'
import BrandLogo from '../components/BrandLogo'

const getRegistrationErrorMessage = (error: unknown) => {
  if (typeof error === 'object' && error && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return '注册失败，请稍后重试'
}

const Register: React.FC = () => {
  const navigate = useNavigate()
  const { register, isLoading } = useStore()
  const [form] = Form.useForm()
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (values: { username: string; password: string; confirmPassword: string }) => {
    setError(null)
    try {
      const { username, password } = values
      await register({ username, password })
      message.success('注册成功，请登录')
      navigate('/login')
    } catch (submitError) {
      setError(getRegistrationErrorMessage(submitError))
    }
  }

  return (
    <div className="auth-page">
      {/* Left brand panel */}
      <div className="auth-brand">
        <div className="auth-brand-content">
          <div className="auth-brand-logo"><BrandLogo title="Agent Flow Platform" /></div>
          <h1 className="auth-brand-title">Agent Flow Platform</h1>
          <p className="auth-brand-desc">
            可视化 AI 应用低代码编排平台
            <br />
            拖拽式工作流 · RAG 知识库 · 多模型接入
          </p>
        </div>
        <div className="auth-brand-footer">
          <span>© 2026 Agent Flow Platform</span>
        </div>
      </div>

      {/* Right form panel */}
      <div className="auth-form-panel">
        <div className="auth-form-wrapper">
          <h2 className="auth-heading">创建账号</h2>
          <p className="auth-subheading">注册一个新的 Agent Flow Platform 账号</p>

          {error && (
            <Alert
              message={error}
              type="error"
              showIcon
              closable
              onClose={() => setError(null)}
              style={{ marginBottom: 20, borderRadius: 10 }}
            />
          )}

          <Form
            form={form}
            onFinish={onSubmit}
            layout="vertical"
            className="auth-form"
            onValuesChange={() => setError(null)}
            requiredMark={false}
            scrollToFirstError
          >
            <Form.Item
              name="username"
              label="用户名"
              rules={[
                { required: true, message: '请输入用户名' },
                { min: 3, message: '用户名长度不足：至少需要 3 位' },
                { max: 20, message: '用户名过长：最多允许 20 位' },
                {
                  pattern: /^[a-zA-Z0-9_]+$/,
                  message: '用户名包含不支持的字符：不能使用中文、空格或特殊符号',
                },
              ]}
              validateFirst
              validateTrigger="onBlur"
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="3–20 位英文、数字或下划线"
                size="large"
                disabled={isLoading}
                autoComplete="username"
              />
            </Form.Item>

            <Form.Item
              name="password"
              label="密码"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码长度不足：至少需要 6 位字符' },
              ]}
              validateFirst
              validateTrigger="onBlur"
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="请输入密码"
                size="large"
                disabled={isLoading}
                autoComplete="new-password"
              />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              label="确认密码"
              dependencies={['password']}
              rules={[
                { required: true, message: '请确认密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve()
                    }
                    return Promise.reject(new Error('两次输入的密码不一致'))
                  },
                }),
              ]}
              validateFirst
              validateTrigger="onBlur"
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="请再次输入密码"
                size="large"
                disabled={isLoading}
                autoComplete="new-password"
              />
            </Form.Item>

            <Form.Item style={{ marginTop: 24 }}>
              <Button
                type="primary"
                htmlType="submit"
                className="auth-submit-btn"
                loading={isLoading}
                disabled={isLoading}
                block
                size="large"
              >
                注  册
              </Button>
            </Form.Item>
          </Form>

          <div className="auth-switch">
            已有账号？ <Link to="/login">立即登录</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Register
