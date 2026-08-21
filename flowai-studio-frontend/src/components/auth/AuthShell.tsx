/**
 * 认证页面外壳：登录/注册页的左右分栏布局。
 *
 * 左侧是品牌介绍区（Logo、平台定位），右侧为表单区，
 * 通过 children 注入实际表单内容，保证两个认证页视觉一致。
 */
import type { ReactNode } from 'react'
import BrandLogo from '../BrandLogo'

/** 认证外壳 props */
interface AuthShellProps {
  title: string
  subtitle: string
  children: ReactNode
}

/** 认证页面外壳组件：品牌区 + 表单区 */
const AuthShell: React.FC<AuthShellProps> = ({ title, subtitle, children }) => (
  <div className="auth-page">
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
      <div className="auth-brand-footer">© 2026 Agent Flow Platform</div>
    </div>

    <main className="auth-form-panel">
      <div className="auth-form-wrapper">
        <h2 className="auth-heading">{title}</h2>
        <p className="auth-subheading">{subtitle}</p>
        {children}
      </div>
    </main>
  </div>
)

export default AuthShell
