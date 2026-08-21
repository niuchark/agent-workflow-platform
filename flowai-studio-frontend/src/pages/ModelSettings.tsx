/**
 * 模型服务配置页面：管理各模型厂商（Qwen/OpenAI-compatible/Ollama）凭证。
 *
 * 支持保存并测试连通性、重新测试、启用/停用与删除配置；
 * 测试通过后凭证自动启用，失败时后端保留配置并标记为不可用。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Popconfirm,
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

/** 支持的模型供应商元信息（展示名、默认 Base URL、是否需要 Key） */
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

/** 每个供应商表单的字段结构 */
type FormState = Record<UserModelProvider, { baseUrl: string; apiKey: string }>

/** 生成初始表单：Base URL 用各供应商默认值 */
const initialForms = (): FormState => Object.fromEntries(
  PROVIDERS.map((item) => [item.provider, { baseUrl: item.defaultBaseUrl, apiKey: '' }]),
) as FormState

/** 按凭证状态计算展示标签（未配置/已启用/测试失败/已停用/待测试） */
const statusPresentation = (summary?: ModelCredentialSummary) => {
  if (!summary?.configured) return { color: 'default', text: '未配置' }
  if (summary.status === 'valid' && summary.isEnabled) return { color: 'success', text: '已启用' }
  if (summary.status === 'invalid') return { color: 'error', text: '测试失败' }
  if (summary.status === 'disabled') return { color: 'warning', text: '已停用' }
  return { color: 'processing', text: '待测试' }
}

/** 提取错误消息：没有具体 message 时用兜底文案 */
const getErrorMessage = (error: unknown, fallback: string) => (
  error instanceof Error && error.message ? error.message : fallback
)

/** 模型服务配置页面组件 */
const ModelSettings: React.FC = () => {
  const [credentials, setCredentials] = useState<ModelCredentialSummary[]>([])
  const [forms, setForms] = useState<FormState>(initialForms)
  const [loading, setLoading] = useState(true)
  const [busyProvider, setBusyProvider] = useState<UserModelProvider | null>(null)
  const initialized = useRef(false)

  // provider → 凭证摘要 的映射，供卡片快速查询
  const credentialMap = useMemo(
    () => new Map(credentials.map((item) => [item.provider, item])),
    [credentials],
  )

  /** 加载凭证列表：回填各供应商的 Base URL */
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
    } catch (error: unknown) {
      message.error(getErrorMessage(error, '加载模型服务配置失败'))
    } finally {
      setLoading(false)
    }
  }

  // 初始化：只加载一次
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    void load()
  }, [])

  /** 更新某个供应商表单的字段 */
  const patchForm = (provider: UserModelProvider, patch: Partial<FormState[UserModelProvider]>) => {
    setForms((current) => ({ ...current, [provider]: { ...current[provider], ...patch } }))
  }

  /** 保存并测试：先保存凭证，再测试连通性；测试失败也保留配置 */
  const saveAndTest = async (provider: UserModelProvider) => {
    const value = forms[provider]
    setBusyProvider(provider)
    try {
      await saveModelCredential(provider, {
        baseUrl: value.baseUrl.trim(),
        ...(value.apiKey.trim() ? { apiKey: value.apiKey.trim() } : {}),
      })
      await testModelCredential(provider)
      patchForm(provider, { apiKey: '' })
      message.success('保存并测试成功，模型服务已启用')
      await load()
    } catch (error: unknown) {
      // 保存成功、测试失败时后端会保留配置并标记为不可用
      message.error(getErrorMessage(error, '连接测试失败'))
      await load()
    } finally {
      setBusyProvider(null)
    }
  }

  /** 重新测试已有凭证的连通性 */
  const retest = async (provider: UserModelProvider) => {
    setBusyProvider(provider)
    try {
      await testModelCredential(provider)
      message.success('连接测试成功')
      await load()
    } catch (error: unknown) {
      message.error(getErrorMessage(error, '连接测试失败'))
      await load()
    } finally {
      setBusyProvider(null)
    }
  }

  /** 停用模型服务 */
  const disable = async (provider: UserModelProvider) => {
    setBusyProvider(provider)
    try {
      await setModelCredentialEnabled(provider, false)
      message.success('模型服务已停用')
      await load()
    } catch (error: unknown) {
      message.error(getErrorMessage(error, '停用失败'))
    } finally {
      setBusyProvider(null)
    }
  }

  /** 删除模型服务配置：重置表单并重新加载 */
  const remove = async (provider: UserModelProvider) => {
    setBusyProvider(provider)
    try {
      await deleteModelCredential(provider)
      patchForm(provider, { ...initialForms()[provider] })
      message.success('模型服务配置已删除')
      await load()
    } catch (error: unknown) {
      message.error(getErrorMessage(error, '删除失败'))
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
                      extra={summary?.hasApiKey
                        ? `已保存：${summary.apiKeyMasked || '••••••••'}。填写新 Key 会覆盖，留空保持不变`
                        : '请输入模型厂商提供的 API Key'}
                    >
                      <Input.Password
                        value={form.apiKey}
                        onChange={(event) => patchForm(meta.provider, { apiKey: event.target.value })}
                        placeholder={summary?.hasApiKey ? '输入新 Key 以覆盖（留空不变）' : '请输入 API Key'}
                        autoComplete="new-password"
                      />
                    </Form.Item>
                  )}
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
