import type { ReactNode } from 'react'
import BrandLogo from '../BrandLogo'

interface AuthShellProps {
  title: string
  subtitle: string
  children: ReactNode
}

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
