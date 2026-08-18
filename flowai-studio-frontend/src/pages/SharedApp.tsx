import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Spin, Result, Button, Typography, Card } from 'antd'
import { RadarChartOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import * as shareApi from '../utils/teamApi'
import './SharedApp.css'

const { Title, Text, Paragraph } = Typography

const SharedApp: React.FC = () => {
  const { shareLink } = useParams<{ shareLink: string }>()
  const navigate = useNavigate()
  const [appData, setAppData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (shareLink) {
      loadSharedApp()
    }
  }, [shareLink])

  const loadSharedApp = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await shareApi.getSharedApp(shareLink!) as any
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
  }

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
    <div className="shared-app-page">
      <div className="shared-app-header">
        <div className="shared-app-logo">
          <RadarChartOutlined />
          <span className="shared-app-logo-text">FlowAI Studio</span>
        </div>
      </div>
      <div className="shared-app-content">
        <Card className="shared-app-card">
          <div className="shared-app-icon">
            {appData?.icon ? (
              <img src={appData.icon} alt="" style={{ width: 48, height: 48 }} />
            ) : (
              <div className="shared-app-icon-default">
                <RadarChartOutlined style={{ fontSize: 32, color: '#7c3aed' }} />
              </div>
            )}
          </div>
          <Title level={3} style={{ textAlign: 'center', marginBottom: 8 }}>
            {appData?.name || '分享的应用'}
          </Title>
          <Paragraph type="secondary" style={{ textAlign: 'center' }}>
            {appData?.description || '由 FlowAI Studio 创建的 AI 应用'}
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
              Powered by FlowAI Studio
            </Text>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default SharedApp
