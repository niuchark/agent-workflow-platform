import { Form, Input, Button, Alert, message } from 'antd'
import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { useNavigate, Link } from 'react-router-dom'
import { useStore } from '../store'
import AuthShell from '../components/auth/AuthShell'
import { PASSWORD_RULES, USERNAME_PLACEHOLDER, USERNAME_RULES } from '../utils/authValidation'

const Register: React.FC = () => {
  const navigate = useNavigate()
  const { register, isLoading, authError, clearError } = useStore()
  const [form] = Form.useForm()

  const onSubmit = async (values: { username: string; password: string; confirmPassword: string }) => {
    clearError()
    try {
      const { username, password } = values
      await register({ username, password })
      message.success('注册成功，请登录')
      navigate('/login')
    } catch {
      // 错误已由用户状态统一处理
    }
  }

  return (
    <AuthShell title="创建账号" subtitle="注册一个新的 Agent Flow Platform 账号">
      {authError && (
        <Alert
          message={authError.message}
          type="error"
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
            size="large"
            disabled={isLoading}
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
        已有账号？ <Link to="/login" onClick={clearError}>立即登录</Link>
      </div>
    </AuthShell>
  )
}

export default Register
