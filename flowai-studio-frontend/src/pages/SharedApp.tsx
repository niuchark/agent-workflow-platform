/**
 * 分享应用页面：通过 /share/:shareLink 公开访问的应用落地页。
 *
 * 无需登录即可访问；根据后端返回展示应用名称、描述与交互界面。
 * 当前交互界面为占位实现，后续接入真实应用运行器。
 */
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Spin, Result, Button, Typography, Card, ConfigProvider, theme as antdTheme } from 'antd'
import * as shareApi from '../utils/teamApi'
import BrandLogo from '../components/BrandLogo'

const { Title, Text, Paragraph } = Typography

/** 分享应用页面组件 */
const SharedApp: React.FC = () => {
  const { shareLink } = useParams<{ shareLink: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  /** 分享应用的数据 */
  const [appData, setAppData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const embedded = searchParams.get('embedded') === '1'
  const requestedTheme = searchParams.get('theme')
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  const darkTheme = requestedTheme === 'dark' || (requestedTheme === 'auto' && prefersDark)
  const showHeader = !embedded || searchParams.get('showHeader') !== 'false'

  /** 加载分享应用：按 404/403 区分错误提示 */
  const loadSharedApp = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await shareApi.getSharedApp(shareLink!, embedded) as any
      setAppData(response.data)
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setError('分享链接不存在或已被撤销')
      } else if (err?.response?.status === 403) {
        setError('此应用未开启公开访问')
      } else {
        setError('加载失败，请稍后重试')
      }
    } finally {
      setIsLoading(false)
    }
  }, [embedded, shareLink])

  // 分享链接变化时重新加载
  useEffect(() => {
    if (shareLink) {
      loadSharedApp()
    }
  }, [loadSharedApp, shareLink])

  if (isLoading) {
    return (
      <div className="shared-app-loading">
        <Spin size="large" />
        <Text type="secondary" style={{ marginTop: 16 }}>加载中…</Text>
      </div>
    )
  }

  if (error) {
    return (
      <div className="shared-app-error">
        <Result
          status="404"
          title="无法访问"
          subTitle={error}
          extra={[
            <Button type="primary" key="home" onClick={() => navigate('/')}>
              返回首页
            </Button>,
          ]}
        />
      </div>
    )
  }

  return (
    <ConfigProvider theme={darkTheme ? { algorithm: antdTheme.darkAlgorithm } : undefined}>
      <div className={`shared-app-page${darkTheme ? ' shared-app-page--dark' : ''}`}>
        {showHeader && (
          <div className="shared-app-header">
            <div className="shared-app-logo">
              <BrandLogo title="Agent Flow Platform" />
              <span className="shared-app-logo-text">Agent Flow Platform</span>
            </div>
          </div>
        )}
        <div className="shared-app-content">
          <Card className="shared-app-card">
          <div className="shared-app-icon">
            {appData?.icon ? (
              <img src={appData.icon} alt="" style={{ width: 48, height: 48 }} />
            ) : (
              <div className="shared-app-icon-default">
                <BrandLogo title="Agent Flow Platform" />
              </div>
            )}
          </div>
          <Title level={3} style={{ textAlign: 'center', marginBottom: 8 }}>
            {appData?.name || '分享的应用'}
          </Title>
          <Paragraph type="secondary" style={{ textAlign: 'center' }}>
            {appData?.description || '由 Agent Flow Platform 创建的 AI 应用'}
          </Paragraph>

          <div className="shared-app-chat-container">
            <div className="shared-app-chat-placeholder">
              <Text type="secondary">应用交互界面加载中…</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                此处将展示应用的实际交互界面
              </Text>
            </div>
          </div>

          <div className="shared-app-footer">
            <Text type="secondary" style={{ fontSize: 12 }}>
              Powered by Agent Flow Platform
            </Text>
          </div>
          </Card>
        </div>
      </div>
    </ConfigProvider>
  )
}

export default SharedApp
