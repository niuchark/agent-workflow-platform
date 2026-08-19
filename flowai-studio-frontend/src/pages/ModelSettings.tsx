import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Popconfirm,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  ApiOutlined,
  CheckCircleOutlined,
  CloudServerOutlined,
  DeleteOutlined,
  DisconnectOutlined,
  ExperimentOutlined,
  ExportOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import {
  deleteModelCredential,
  getModelCredentials,
  ModelCredentialSummary,
  saveModelCredential,
  setModelCredentialEnabled,
  testModelCredential,
  UserModelProvider,
} from '../utils/modelCredentialApi'

const { Text, Paragraph } = Typography

const PROVIDERS: Array<{
  provider: UserModelProvider
  title: string
  description: string
  defaultBaseUrl: string
  requiresKey: boolean
  icon: React.ReactNode
  recommended?: boolean
  apiKeyUrl?: string
}> = [
  {
    provider: 'qwen',
    title: 'Qwen（阿里云百炼）',
    description: '同一枚 Key 同时用于对话模型和 Embedding。',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    requiresKey: true,
    icon: <CloudServerOutlined />,
    recommended: true,
    apiKeyUrl: 'https://bailian.console.aliyun.com/?tab=model',
  },
  {
    provider: 'openai',
    title: 'OpenAI-compatible',
    description: '支持 OpenAI 官方服务和实现 OpenAI 协议的第三方服务。',
    defaultBaseUrl: 'https://api.openai.com/v1',
    requiresKey: true,
    icon: <ApiOutlined />,
  },
  {
    provider: 'ollama',
    title: 'Ollama',
    description: '连接自建 Ollama，无需 API Key；私网地址须由管理员加入白名单。',
    defaultBaseUrl: 'http://ollama:11434',
    requiresKey: false,
    icon: <ExperimentOutlined />,
  },
]

type FormState = Record<UserModelProvider, { baseUrl: string; apiKey: string; clearApiKey: boolean }>

const initialForms = (): FormState => Object.fromEntries(
  PROVIDERS.map((item) => [item.provider, { baseUrl: item.defaultBaseUrl, apiKey: '', clearApiKey: false }]),
) as FormState

const statusPresentation = (summary?: ModelCredentialSummary) => {
  if (!summary?.configured) return { color: 'default', text: '未配置' }
  if (summary.status === 'valid' && summary.isEnabled) return { color: 'success', text: '已启用' }
  if (summary.status === 'invalid') return { color: 'error', text: '测试失败' }
  if (summary.status === 'disabled') return { color: 'warning', text: '已停用' }
  return { color: 'processing', text: '待测试' }
}

const ModelSettings: React.FC = () => {
  const [credentials, setCredentials] = useState<ModelCredentialSummary[]>([])
  const [forms, setForms] = useState<FormState>(initialForms)
  const [loading, setLoading] = useState(true)
  const [busyProvider, setBusyProvider] = useState<UserModelProvider | null>(null)
  const initialized = useRef(false)

  const credentialMap = useMemo(
    () => new Map(credentials.map((item) => [item.provider, item])),
    [credentials],
  )

  const load = async () => {
    try {
      const list = await getModelCredentials()
      setCredentials(list)
      setForms((previous) => {
        const next = { ...previous }
        for (const item of list) {
          next[item.provider] = { ...next[item.provider], baseUrl: item.baseUrl }
        }
        return next
      })
    } catch (error: any) {
      message.error(error.message || '加载模型服务配置失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    void load()
  }, [])

  const patchForm = (provider: UserModelProvider, patch: Partial<FormState[UserModelProvider]>) => {
    setForms((current) => ({ ...current, [provider]: { ...current[provider], ...patch } }))
  }

  const saveAndTest = async (provider: UserModelProvider) => {
    const value = forms[provider]
    setBusyProvider(provider)
    try {
      await saveModelCredential(provider, {
        baseUrl: value.baseUrl.trim(),
        ...(value.apiKey.trim() ? { apiKey: value.apiKey.trim() } : {}),
        ...(value.clearApiKey ? { clearApiKey: true } : {}),
      })
      await testModelCredential(provider)
      patchForm(provider, { apiKey: '', clearApiKey: false })
      message.success('保存并测试成功，模型服务已启用')
      await load()
    } catch (error: any) {
      // 保存成功、测试失败时后端会保留配置并标记为不可用。
      message.error(error.message || '连接测试失败')
      await load()
    } finally {
      setBusyProvider(null)
    }
  }

  const retest = async (provider: UserModelProvider) => {
    setBusyProvider(provider)
    try {
      await testModelCredential(provider)
      message.success('连接测试成功')
      await load()
    } catch (error: any) {
      message.error(error.message || '连接测试失败')
      await load()
    } finally {
      setBusyProvider(null)
    }
  }

  const disable = async (provider: UserModelProvider) => {
    setBusyProvider(provider)
    try {
      await setModelCredentialEnabled(provider, false)
      message.success('模型服务已停用')
      await load()
    } catch (error: any) {
      message.error(error.message || '停用失败')
    } finally {
      setBusyProvider(null)
    }
  }

  const remove = async (provider: UserModelProvider) => {
    setBusyProvider(provider)
    try {
      await deleteModelCredential(provider)
      patchForm(provider, { ...initialForms()[provider] })
      message.success('模型服务配置已删除')
      await load()
    } catch (error: any) {
      message.error(error.message || '删除失败')
    } finally {
      setBusyProvider(null)
    }
  }

  return (
    <div className="model-settings-page">
      <div className="model-settings-heading">
        <div>
          <h2 className="model-settings-title">模型服务</h2>
          <Paragraph className="model-settings-subtitle">配置你自己的模型厂商凭证，调用费用由对应厂商账户承担。</Paragraph>
        </div>
        <div className="model-settings-security"><SafetyCertificateOutlined /> Key 加密保存，永不回显明文</div>
      </div>

      <Alert
        type="info"
        showIcon
        message="这里的模型厂商 Key 与「API 密钥」不同"
        description="模型厂商 Key 用于调用 Qwen、OpenAI-compatible 或 Ollama；侧栏中的 API 密钥用于外部程序访问本平台"
        className="model-settings-alert"
      />

      {loading ? <div className="model-settings-loading"><Spin /></div> : (
        <div className="model-provider-grid">
          {PROVIDERS.map((meta) => {
            const summary = credentialMap.get(meta.provider)
            const status = statusPresentation(summary)
            const form = forms[meta.provider]
            const isBusy = busyProvider === meta.provider
            return (
              <Card key={meta.provider} className="model-provider-card">
                <div className="model-provider-card-header">
                  <div className="model-provider-icon">{meta.icon}</div>
                  <div className="model-provider-copy">
                    <div className="model-provider-title-row">
                      <div className="model-provider-title-main">
                        <h3>{meta.title}</h3>
                        {meta.recommended && <Tag color="blue">推荐</Tag>}
                        {meta.apiKeyUrl && (
                          <Button
                            size="small"
                            href={meta.apiKeyUrl}
                            target="_blank"
                            rel="noreferrer"
                            icon={<ExportOutlined />}
                            className="model-provider-apply-key"
                          >
                            申请 API Key
                          </Button>
                        )}
                      </div>
                      <Tag color={status.color}>{status.text}</Tag>
                    </div>
                    <Paragraph>{meta.description}</Paragraph>
                  </div>
                </div>

                <Form layout="vertical" requiredMark={false}>
                  <Form.Item label="Base URL" required>
                    <Input
                      value={form.baseUrl}
                      onChange={(event) => patchForm(meta.provider, { baseUrl: event.target.value })}
                      placeholder={meta.defaultBaseUrl}
                      autoComplete="url"
                    />
                  </Form.Item>
                  {meta.requiresKey && (
                    <Form.Item
                      label="API Key"
                      extra={summary?.hasApiKey ? `已保存：${summary.apiKeyMasked || '••••••••'}；留空不会覆盖` : '密钥仅发送到服务端加密保存'}
                    >
                      <Input.Password
                        value={form.apiKey}
                        onChange={(event) => patchForm(meta.provider, { apiKey: event.target.value, clearApiKey: false })}
                        placeholder={summary?.hasApiKey ? '留空以保留已有 Key' : '请输入 API Key'}
                        autoComplete="new-password"
                      />
                      {summary?.hasApiKey && (
                        <Button
                          type="link"
                          danger
                          size="small"
                          className="model-clear-key"
                          onClick={() => patchForm(meta.provider, { apiKey: '', clearApiKey: !form.clearApiKey })}
                        >
                          {form.clearApiKey ? '取消清除 Key' : '保存时清除 Key'}
                        </Button>
                      )}
                    </Form.Item>
                  )}
                  {form.clearApiKey && <Alert type="warning" showIcon message="本次保存将清除已有 Key，服务会保持停用。" />}
                </Form>

                {summary?.lastTestMessage && (
                  <div className={`model-test-result model-test-result--${summary.status}`}>
                    {summary.status === 'valid' ? <CheckCircleOutlined /> : <DisconnectOutlined />}
                    <span>{summary.lastTestMessage}</span>
                    {summary.lastTestedAt && <Text type="secondary">{new Date(summary.lastTestedAt).toLocaleString()}</Text>}
                  </div>
                )}

                <div className="model-provider-actions">
                  <Button type="primary" loading={isBusy} onClick={() => void saveAndTest(meta.provider)}>
                    保存并测试
                  </Button>
                  {summary?.configured && (
                    <Button disabled={isBusy} onClick={() => void retest(meta.provider)}>重新测试</Button>
                  )}
                  {summary?.isEnabled && (
                    <Button disabled={isBusy} onClick={() => void disable(meta.provider)}>停用</Button>
                  )}
                  {summary?.configured && (
                    <Popconfirm title="删除此模型服务配置？" description="删除后无法恢复已保存的 Key。" onConfirm={() => void remove(meta.provider)}>
                      <Button danger type="text" icon={<DeleteOutlined />} disabled={isBusy}>删除</Button>
                    </Popconfirm>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ModelSettings
