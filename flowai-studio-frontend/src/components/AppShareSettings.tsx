import { useState, useEffect } from 'react'
import {
  Button, Card, Switch, Form, Input, Select, Space, message,
  Typography, Spin, Popconfirm, Tabs, Alert,
} from 'antd'
import {
  ShareAltOutlined, CopyOutlined, LinkOutlined,
  CodeOutlined, DeleteOutlined, GlobalOutlined,
} from '@ant-design/icons'
import * as shareApi from '../utils/teamApi'
import { AppShare, EmbedConfig, UpdateShareSettingsForm } from '../types'

const { Text, Paragraph, Title } = Typography

interface AppShareSettingsProps {
  appId: string
}

const AppShareSettings: React.FC<AppShareSettingsProps> = ({ appId }) => {
  const [shareInfo, setShareInfo] = useState<AppShare | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [embedCode, setEmbedCode] = useState<{ iframeCode: string; scriptCode: string } | null>(null)

  useEffect(() => {
    loadShareInfo()
  }, [appId])

  const loadShareInfo = async () => {
    setIsLoading(true)
    try {
      const response = await shareApi.getShareInfo(appId) as any
      setShareInfo(response.data || null)
    } catch {
      // 应用可能还没有分享信息
      setShareInfo(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGenerateShareLink = async () => {
    setIsLoading(true)
    try {
      const response = await shareApi.generateShareLink(appId) as any
      setShareInfo(response.data)
      message.success('分享链接已生成')
    } catch {
      message.error('生成失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRevokeShareLink = async () => {
    try {
      await shareApi.revokeShareLink(appId)
      setShareInfo(null)
      setEmbedCode(null)
      message.success('分享链接已撤销')
    } catch {
      message.error('撤销失败')
    }
  }

  const handleTogglePublic = async (isPublic: boolean) => {
    try {
      const response = await shareApi.updateShareSettings(appId, { isPublic }) as any
      setShareInfo(response.data)
      message.success(isPublic ? '已开启公开访问' : '已关闭公开访问')
    } catch {
      message.error('设置失败')
    }
  }

  const handleUpdateEmbed = async (values: { width?: string; height?: string; theme?: string; showHeader?: boolean }) => {
    try {
      const embedConfig: EmbedConfig = {
        enabled: true,
        width: values.width || '100%',
        height: values.height || '600px',
        theme: (values.theme as 'light' | 'dark' | 'auto') || 'auto',
        showHeader: values.showHeader ?? true,
      }
      const response = await shareApi.updateShareSettings(appId, { embedConfig }) as any
      setShareInfo(response.data)
      message.success('嵌入设置已更新')
    } catch {
      message.error('设置失败')
    }
  }

  const handleGetEmbedCode = async () => {
    try {
      const response = await shareApi.getEmbedCode(appId) as any
      setEmbedCode(response.data)
    } catch {
      message.error('获取嵌入代码失败')
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success('已复制到剪贴板')
    }).catch(() => {
      message.error('复制失败')
    })
  }

  const shareUrl = shareInfo
    ? `${window.location.origin}/share/${shareInfo.shareLink}`
    : ''

  if (isLoading && !shareInfo) {
    return <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
  }

  return (
    <div className="app-share-settings">
      {!shareInfo ? (
        <Card className="share-card">
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <ShareAltOutlined style={{ fontSize: 48, color: '#7c3aed', marginBottom: 16 }} />
            <Title level={5}>分享此应用</Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
              生成分享链接，让其他人可以通过链接访问此应用
            </Text>
            <Button
              type="primary"
              icon={<LinkOutlined />}
              onClick={handleGenerateShareLink}
              loading={isLoading}
            >
              生成分享链接
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {/* 分享链接 */}
          <Card title={<><LinkOutlined /> 分享链接</>} className="share-card" style={{ marginBottom: 16 }}>
            <div className="share-link-row">
              <Input
                value={shareUrl}
                readOnly
                style={{ flex: 1 }}
              />
              <Button
                icon={<CopyOutlined />}
                onClick={() => handleCopy(shareUrl)}
              >
                复制
              </Button>
            </div>

            <div className="share-public-toggle" style={{ marginTop: 16 }}>
              <Space>
                <GlobalOutlined />
                <Text>公开访问</Text>
                <Switch
                  checked={shareInfo.isPublic}
                  onChange={handleTogglePublic}
                  checkedChildren="开"
                  unCheckedChildren="关"
                />
              </Space>
              <Text type="secondary" style={{ display: 'block', marginTop: 4, marginLeft: 28 }}>
                {shareInfo.isPublic
                  ? '任何人都可以通过链接访问此应用'
                  : '需要登录才能访问此应用'}
              </Text>
            </div>

            <div style={{ marginTop: 16 }}>
              <Popconfirm
                title="撤销后使用原链接的访问将失效，确定撤销吗？"
                onConfirm={handleRevokeShareLink}
                okText="确定"
                cancelText="取消"
              >
                <Button danger icon={<DeleteOutlined />} size="small">
                  撤销分享链接
                </Button>
              </Popconfirm>
            </div>
          </Card>

          {/* 嵌入代码 */}
          <Card title={<><CodeOutlined /> 嵌入代码</>} className="share-card">
            <Tabs
              items={[
                {
                  key: 'settings',
                  label: '嵌入设置',
                  children: (
                    <Form
                      layout="vertical"
                      onFinish={handleUpdateEmbed}
                      initialValues={{
                        width: shareInfo.embedConfig?.width || '100%',
                        height: shareInfo.embedConfig?.height || '600px',
                        theme: shareInfo.embedConfig?.theme || 'auto',
                        showHeader: shareInfo.embedConfig?.showHeader ?? true,
                      }}
                    >
                      <Space size="large" wrap>
                        <Form.Item name="width" label="宽度">
                          <Input placeholder="100%" style={{ width: 120 }} />
                        </Form.Item>
                        <Form.Item name="height" label="高度">
                          <Input placeholder="600px" style={{ width: 120 }} />
                        </Form.Item>
                        <Form.Item name="theme" label="主题">
                          <Select style={{ width: 120 }} options={[
                            { label: '自动', value: 'auto' },
                            { label: '浅色', value: 'light' },
                            { label: '深色', value: 'dark' },
                          ]} />
                        </Form.Item>
                        <Form.Item name="showHeader" label="显示标题" valuePropName="checked">
                          <Switch />
                        </Form.Item>
                      </Space>
                      <Button type="primary" htmlType="submit">
                        保存设置
                      </Button>
                    </Form>
                  ),
                },
                {
                  key: 'code',
                  label: '嵌入代码',
                  children: (
                    <div>
                      <Button
                        type="primary"
                        icon={<CodeOutlined />}
                        onClick={handleGetEmbedCode}
                        style={{ marginBottom: 16 }}
                      >
                        生成嵌入代码
                      </Button>
                      {embedCode && (
                        <div className="embed-code-box">
                          <div className="embed-code-label">iframe 嵌入</div>
                          <Input.TextArea
                            value={embedCode.iframeCode}
                            readOnly
                            autoSize={{ minRows: 3, maxRows: 6 }}
                            style={{ fontFamily: 'monospace', fontSize: 12 }}
                          />
                          <Button
                            size="small"
                            icon={<CopyOutlined />}
                            onClick={() => handleCopy(embedCode.iframeCode)}
                            style={{ marginTop: 4 }}
                          >
                            复制
                          </Button>

                          <div className="embed-code-label" style={{ marginTop: 16 }}>Script 嵌入</div>
                          <Input.TextArea
                            value={embedCode.scriptCode}
                            readOnly
                            autoSize={{ minRows: 3, maxRows: 6 }}
                            style={{ fontFamily: 'monospace', fontSize: 12 }}
                          />
                          <Button
                            size="small"
                            icon={<CopyOutlined />}
                            onClick={() => handleCopy(embedCode.scriptCode)}
                            style={{ marginTop: 4 }}
                          >
                            复制
                          </Button>
                        </div>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </Card>
        </>
      )}
    </div>
  )
}

export default AppShareSettings
