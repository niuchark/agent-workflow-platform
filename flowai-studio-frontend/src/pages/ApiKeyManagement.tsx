import { useState, useEffect, useRef } from 'react'
import {
  Button, Modal, Form, Input, Select, Table, Tag, Space, message,
  Popconfirm, Empty, Spin, Switch, Typography, Alert, InputNumber,
} from 'antd'
import {
  PlusOutlined, KeyOutlined, DeleteOutlined, CopyOutlined,
  StopOutlined, CheckCircleOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons'
import { useStore } from '../store'
import { ApiKey, CreateApiKeyForm, API_KEY_SCOPE_OPTIONS } from '../types'
import './ApiKeyManagement.css'

const { Text, Paragraph } = Typography

const ApiKeyManagement: React.FC = () => {
  const {
    apiKeys, createdKey, isLoading,
    fetchApiKeys, createApiKey, deleteApiKey, toggleApiKey, setCreatedKey,
    apps, fetchApps,
  } = useStore()

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isKeyRevealModalOpen, setIsKeyRevealModalOpen] = useState(false)
  const [form] = Form.useForm()
  const initDone = useRef(false)

  useEffect(() => {
    if (initDone.current) return
    initDone.current = true
    fetchApiKeys()
    fetchApps()
  }, [])

  // 创建成功后显示完整密钥
  useEffect(() => {
    if (createdKey) {
      setIsKeyRevealModalOpen(true)
    }
  }, [createdKey])

  const handleCreate = () => {
    form.resetFields()
    setIsCreateModalOpen(true)
  }

  const handleCreateSubmit = async (values: CreateApiKeyForm) => {
    try {
      await createApiKey(values)
      message.success('API 密钥创建成功')
      setIsCreateModalOpen(false)
      fetchApiKeys()
    } catch {
      message.error('创建失败，请重试')
    }
  }

  const handleDelete = async (keyId: string) => {
    try {
      await deleteApiKey(keyId)
      message.success('API 密钥已删除')
    } catch {
      message.error('删除失败')
    }
  }

  const handleToggle = async (keyId: string, isActive: boolean) => {
    try {
      await toggleApiKey(keyId, !isActive)
      message.success(isActive ? 'API 密钥已禁用' : 'API 密钥已启用')
    } catch {
      message.error('操作失败')
    }
  }

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key).then(() => {
      message.success('已复制到剪贴板')
    }).catch(() => {
      message.error('复制失败，请手动复制')
    })
  }

  const handleCloseKeyReveal = () => {
    setIsKeyRevealModalOpen(false)
    setCreatedKey(null)
  }

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: ApiKey) => (
        <div className="apikey-name-cell">
          <KeyOutlined style={{ color: record.isActive ? '#7c3aed' : '#8c8c8c' }} />
          <div className="apikey-name-info">
            <span className="apikey-name-text">{name}</span>
            <span className="apikey-prefix">{record.keyPrefix}…</span>
          </div>
        </div>
      ),
    },
    {
      title: '权限范围',
      dataIndex: 'scopes',
      key: 'scopes',
      width: 240,
      render: (scopes: string[]) => (
        <Space wrap size={[4, 4]}>
          {scopes?.map((scope) => (
            <Tag key={scope} color="purple" style={{ fontSize: 11 }}>
              {API_KEY_SCOPE_OPTIONS.find((o) => o.value === scope)?.label || scope}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 120,
      render: (isActive: boolean, record: ApiKey) => (
        <Switch
          checked={isActive}
          onChange={(checked) => handleToggle(record.id, !checked)}
          checkedChildren="启用"
          unCheckedChildren="禁用"
          size="small"
        />
      ),
    },
    {
      title: '最后使用',
      dataIndex: 'lastUsedAt',
      key: 'lastUsedAt',
      width: 140,
      render: (date: string) => date ? new Date(date).toLocaleDateString('zh-CN') : '从未使用',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 140,
      render: (date: string) => new Date(date).toLocaleDateString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: unknown, record: ApiKey) => (
        <Popconfirm
          title="确定要删除此 API 密钥吗？删除后使用该密钥的请求将失败"
          onConfirm={() => handleDelete(record.id)}
          okText="确定"
          cancelText="取消"
        >
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <div className="apikey-management-page">
      <div className="apikey-toolbar">
        <div className="apikey-toolbar-left">
          <h2 className="apikey-page-title">API 密钥</h2>
          <span className="apikey-count-badge">{apiKeys.length}</span>
        </div>
        <div className="apikey-toolbar-right">
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            创建密钥
          </Button>
        </div>
      </div>

      <div className="apikey-tip">
        <Alert
          message="API 密钥用于外部程序访问 FlowAI Studio 的 API。创建后请妥善保管，密钥仅在创建时显示一次。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      </div>

      {isLoading ? (
        <div className="apikey-loading">
          <Spin size="large" />
        </div>
      ) : apiKeys.length > 0 ? (
        <Table
          dataSource={apiKeys}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 个密钥` }}
          className="apikey-table"
        />
      ) : (
        <div className="apikey-empty-wrapper">
          <Empty description="暂无 API 密钥，点击「创建密钥」生成" />
        </div>
      )}

      {/* 创建密钥弹窗 */}
      <Modal
        title="创建 API 密钥"
        open={isCreateModalOpen}
        onCancel={() => setIsCreateModalOpen(false)}
        footer={null}
        width={520}
      >
        <Form form={form} onFinish={handleCreateSubmit} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="密钥名称"
            rules={[{ required: true, message: '请输入密钥名称' }]}
          >
            <Input placeholder="例如：生产环境密钥" />
          </Form.Item>
          <Form.Item name="applicationId" label="关联应用（可选）">
            <Select
              placeholder="选择要关联的应用"
              allowClear
              options={(Array.isArray(apps) ? apps : []).map((app) => ({
                value: app.id,
                label: app.name,
              }))}
            />
          </Form.Item>
          <Form.Item name="scopes" label="权限范围">
            <Select
              mode="multiple"
              placeholder="选择权限范围（留空则拥有全部权限）"
              options={API_KEY_SCOPE_OPTIONS}
            />
          </Form.Item>
          <div className="modal-footer">
            <Button onClick={() => setIsCreateModalOpen(false)}>取消</Button>
            <Button type="primary" htmlType="submit" loading={isLoading} icon={<KeyOutlined />}>
              创建密钥
            </Button>
          </div>
        </Form>
      </Modal>

      {/* 密钥显示弹窗（仅创建时显示一次） */}
      <Modal
        title="API 密钥已创建"
        open={isKeyRevealModalOpen}
        onCancel={handleCloseKeyReveal}
        footer={
          <Button type="primary" onClick={handleCloseKeyReveal}>
            我已安全保存密钥
          </Button>
        }
        width={560}
        closable={false}
        maskClosable={false}
      >
        <Alert
          message="请立即保存此密钥！关闭此窗口后将无法再次查看完整密钥。"
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
          style={{ marginBottom: 16 }}
        />
        {createdKey && (
          <div className="apikey-reveal-box">
            <div className="apikey-reveal-label">密钥名称</div>
            <Text strong>{createdKey.name}</Text>
            <div className="apikey-reveal-label" style={{ marginTop: 12 }}>完整密钥</div>
            <div className="apikey-reveal-key">
              <Input.TextArea
                value={createdKey.key}
                readOnly
                autoSize={{ minRows: 2, maxRows: 4 }}
                style={{ fontFamily: 'monospace', fontSize: 13 }}
              />
              <Button
                type="primary"
                icon={<CopyOutlined />}
                onClick={() => handleCopyKey(createdKey.key)}
                style={{ marginTop: 8 }}
              >
                复制密钥
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default ApiKeyManagement
