/**
 * 登录页面：用户名 + 密码登录。
 *
 * 使用共享的校验规则与 AuthShell 布局；登录成功后跳转工作台，
 * 失败时根据 AuthError 类型展示不同级别的提示与说明文案。
 */
import { Form, Input, Button, Alert, Checkbox } from 'antd'
import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { useNavigate, Link } from 'react-router-dom'
import { useStore } from '../store'
import AuthShell from '../components/auth/AuthShell'
import { PASSWORD_RULES, USERNAME_PLACEHOLDER, USERNAME_RULES } from '../utils/authValidation'

const Login: React.FC = () => {
  const navigate = useNavigate()
  const { login, isLoading, authError, clearError } = useStore()
  const [form] = Form.useForm()

  /** 按错误类型映射 Alert 级别 */
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

  /** 按错误类型给出更具体的解决建议 */
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

  /** 提交登录：成功后跳转应用列表页 */
  const onSubmit = async (values: { username: string; password: string; remember?: boolean }) => {
    clearError()
    try {
      const { username, password } = values
      await login({ username, password })
      navigate('/apps')
    } catch (err) {
      console.error('Login error:', err)
    }
  }

  return (
    <AuthShell title="登录" subtitle="欢迎回来，请登录你的账号">
      {authError && (
        <Alert
          message={authError.message}
          description={getAlertDescription()}
          type={getAlertType()}
          showIcon
          closable
          onClose={clearError}
          style={{ marginBottom: 20, borderRadius: 10 }}
        />
      )}

      <Form
        form={form}
        onFinish={onSubmit}
        layout="vertical"
        className="auth-form"
        onValuesChange={clearError}
        requiredMark={false}
        scrollToFirstError
      >
        <Form.Item
          name="username"
          label="用户名"
          rules={USERNAME_RULES}
          validateFirst
          validateTrigger="onBlur"
        >
          <Input
            prefix={<UserOutlined />}
            placeholder={USERNAME_PLACEHOLDER}
            disabled={isLoading}
            size="large"
            autoComplete="username"
          />
        </Form.Item>

        <Form.Item
          name="password"
          label="密码"
          rules={PASSWORD_RULES}
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
        还没有账号？ <Link to="/register" onClick={clearError}>立即注册</Link>
      </div>
    </AuthShell>
  )
}

export default Login
