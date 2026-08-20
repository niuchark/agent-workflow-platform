import { useState, useEffect } from 'react'
import { Form, Input, Button, Alert, Checkbox } from 'antd'
import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { useNavigate, Link } from 'react-router-dom'
import { useStore } from '../store'
import BrandLogo from '../components/BrandLogo'

const Login: React.FC = () => {
  const navigate = useNavigate()
  const { login, isLoading, authError, clearError } = useStore()
  const [form] = Form.useForm()
  const [showError, setShowError] = useState(false)

  useEffect(() => {
    if (authError) setShowError(true)
  }, [authError])

  const handleClearError = () => {
    setShowError(false)
    clearError()
  }

  const getAlertType = () => {
    if (!authError) return 'error' as const
    switch (authError.type) {
      case 'LOCKED':
        return 'warning' as const
      case 'NETWORK':
      case 'SERVER':
        return 'info' as const
      default:
        return 'error' as const
    }
  }

  const getAlertDescription = () => {
    if (!authError) return undefined

    switch (authError.type) {
      case 'AUTHENTICATION':
        return '为保护账号安全，系统不会指出具体哪一项不匹配。请检查用户名拼写和密码后重试。'
      case 'VALIDATION':
        return '请根据对应输入框下方的提示修改后再提交。'
      case 'NETWORK':
        return '请确认设备已联网，或稍后重新尝试。'
      case 'SERVER':
        return '这不是你的填写问题，请稍后重新尝试。'
      default:
        return undefined
    }
  }

  const onSubmit = async (values: { username: string; password: string; remember?: boolean }) => {
    handleClearError()
    try {
      const { username, password } = values
      await login({ username, password })
      navigate('/apps')
    } catch (err) {
      console.error('Login error:', err)
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
          <h2 className="auth-heading">登录</h2>
          <p className="auth-subheading">欢迎回来，请登录你的账号</p>

          {showError && authError && (
            <Alert
              message={authError.message}
              description={getAlertDescription()}
              type={getAlertType()}
              showIcon
              closable
              onClose={handleClearError}
              style={{ marginBottom: 20, borderRadius: 10 }}
            />
          )}

          <Form
            form={form}
            onFinish={onSubmit}
            layout="vertical"
            className="auth-form"
            onValuesChange={handleClearError}
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
                disabled={isLoading}
                size="large"
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
                disabled={isLoading}
                size="large"
                autoComplete="current-password"
              />
            </Form.Item>

            <div className="auth-form-extra">
              <Form.Item name="remember" valuePropName="checked" noStyle>
                <Checkbox disabled={isLoading}>记住我</Checkbox>
              </Form.Item>
            </div>

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
                {isLoading ? '登录中…' : '登  录'}
              </Button>
            </Form.Item>
          </Form>

          <div className="auth-switch">
            还没有账号？ <Link to="/register">立即注册</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
