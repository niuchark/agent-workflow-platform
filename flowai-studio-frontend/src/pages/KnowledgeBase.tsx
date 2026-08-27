/**
 * 知识库页面：管理知识库配置、文档上传与分块预览。
 *
 * - 知识库 CRUD：embedding 服务、向量存储、检索模式（向量/关键词/混合）、
 *   分块参数、相似度阈值与重排序配置；
 * - 文档管理：拖拽上传（后台异步向量化）、删除、分块预览；
 * - 混合检索可调向量权重与 RRF 常数 K。
 */
import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Input, Table, message, Modal, Upload, Space, Typography, Empty, Spin, Select, Slider, InputNumber, Divider, Tag, Tooltip, Switch } from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  BookOutlined,
  FolderOpenOutlined,
  FileTextOutlined,
  InboxOutlined,
  DatabaseOutlined,
  BlockOutlined,
  ArrowLeftOutlined,
  SettingOutlined,
  CloudServerOutlined,
  RobotOutlined,
  SearchOutlined,
  ExperimentOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import { useStore } from '../store'
import { Document as KnowledgeDocument, DocumentChunk, EmbeddingProviderType, VectorStoreType, RerankerProviderType, EMBEDDING_MODELS, VECTOR_STORE_OPTIONS, RETRIEVAL_MODE_OPTIONS, OLLAMA_RERANK_MODELS } from '../types'
import { useNavigate } from 'react-router-dom'
import { useModelCatalog } from '../utils/useModelCatalog'

const { Text } = Typography
const { TextArea } = Input
const { Dragger } = Upload

const DOCUMENT_STATUS: Record<string, { label: string; tone: string }> = {
  processing: { label: '处理中', tone: 'processing' },
  completed: { label: '已完成', tone: 'completed' },
  failed: { label: '失败', tone: 'failed' },
}

/** 文件大小格式化：保持短小，避免窄屏列被长数字撑开 */
const formatFileSize = (size?: number) => {
  if (size == null || Number.isNaN(size)) return '—'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

/** 文档状态同时使用文字与语义色，避免只靠颜色表达 */
const renderDocumentStatus = (status?: string) => {
  const value = DOCUMENT_STATUS[status || ''] || DOCUMENT_STATUS.completed
  return <span className={`doc-status doc-status--${value.tone}`}>{value.label}</span>
}

/** 知识库页面组件 */
const KnowledgeBase: React.FC = () => {
  const navigate = useNavigate()
  const { availableProviders, loading: modelCatalogLoading } = useModelCatalog()
  const {
    knowledgeBases,
    ragLoading,
    fetchKnowledgeBases,
    fetchKnowledgeBaseById,
    createKnowledgeBase,
    updateKnowledgeBase,
    deleteKnowledgeBase,
    uploadDocument,
    deleteDocument,
    fetchDocumentChunks,
  } = useStore()
  const [modalVisible, setModalVisible] = useState(false)
  const [documentModalVisible, setDocumentModalVisible] = useState(false)
  const [editingKb, setEditingKb] = useState<any>(null)
  const [selectedKb, setSelectedKb] = useState<any>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    embeddingProvider: 'qwen' as EmbeddingProviderType,
    embeddingModel: 'text-embedding-v3',
    embeddingDimension: 1024,
    vectorStore: 'pgvector' as VectorStoreType,
    chunkSize: 500,
    chunkOverlap: 50,
    topK: 5,
    similarityThreshold: 0.7,
    retrievalMode: 'vector' as 'vector' | 'keyword' | 'hybrid',
    vectorWeight: 0.7,
    rrfK: 60,
    // Phase 2.3: Reranker 配置
    rerankerEnabled: false,
    rerankerProvider: 'none' as RerankerProviderType,
    rerankerModel: '',
    rerankerTopN: 5,
  })
  const [documents, setDocuments] = useState<any[]>([])
  const [chunkModalVisible, setChunkModalVisible] = useState(false)
  const [chunkDocName, setChunkDocName] = useState('')
  const [chunks, setChunks] = useState<DocumentChunk[]>([])
  const [chunksLoading, setChunksLoading] = useState(false)

  // 进入页面加载知识库列表
  useEffect(() => { fetchKnowledgeBases() }, [fetchKnowledgeBases])

  const safeKnowledgeBases = knowledgeBases
  // 全库文档总量统计
  const totalDocuments = useMemo(
    () => safeKnowledgeBases.reduce((count, kb) => count + (kb.documents?.length || 0), 0),
    [safeKnowledgeBases],
  )

  // Embedding 模型配置来自 types/index.ts 中的 EMBEDDING_MODELS 常量

  /** 打开新建知识库弹窗：重置表单为默认配置 */
  const handleAddKb = () => {
    setEditingKb(null)
    setFormData({
      name: '', description: '',
      embeddingProvider: 'qwen', embeddingModel: 'text-embedding-v3', embeddingDimension: 1024,
      vectorStore: 'pgvector',
      chunkSize: 500, chunkOverlap: 50, topK: 5, similarityThreshold: 0.7,
      retrievalMode: 'vector' as 'vector' | 'keyword' | 'hybrid',
      vectorWeight: 0.7,
      rrfK: 60,
      rerankerEnabled: false, rerankerProvider: 'none', rerankerModel: '', rerankerTopN: 5,
    })
    setModalVisible(true)
  }

  /** 打开编辑弹窗：回填知识库配置 */
  const handleEditKb = (kb: any) => {
    setEditingKb(kb)
    setFormData({
      name: kb.name, description: kb.description || '',
      embeddingProvider: kb.embeddingProvider || 'qwen',
      embeddingModel: kb.embeddingModel || 'text-embedding-v3',
      embeddingDimension: kb.embeddingDimension ?? 1024,
      vectorStore: kb.vectorStore || 'pgvector',
      chunkSize: kb.chunkSize ?? 500, chunkOverlap: kb.chunkOverlap ?? 50,
      topK: kb.topK ?? 5, similarityThreshold: kb.similarityThreshold ?? 0.7,
      retrievalMode: kb.retrievalMode || 'vector',
      vectorWeight: kb.vectorWeight ?? 0.7,
      rrfK: kb.rrfK ?? 60,
      rerankerEnabled: kb.rerankerEnabled ?? false,
      rerankerProvider: kb.rerankerProvider || 'none',
      rerankerModel: kb.rerankerModel || '',
      rerankerTopN: kb.rerankerTopN ?? 5,
    })
    setModalVisible(true)
  }

  /** 保存知识库（新建或更新） */
  const handleSaveKb = async () => {
    if (!formData.name) { message.error('请输入知识库名称'); return }
    try {
      if (editingKb) {
        await updateKnowledgeBase(editingKb.id, formData)
        message.success('知识库更新成功')
      } else {
        await createKnowledgeBase(formData)
        message.success('知识库创建成功')
      }
      setModalVisible(false)
    } catch { message.error('操作失败，请重试') }
  }

  /** 删除知识库 */
  const handleDeleteKb = async (id: string) => {
    try { await deleteKnowledgeBase(id); message.success('知识库删除成功') }
    catch { message.error('删除失败，请重试') }
  }

  /** 打开文档管理弹窗 */
  const handleViewDocuments = async (kb: any) => {
    setSelectedKb(kb); setDocuments(kb.documents || []); setDocumentModalVisible(true)
  }

  /** 上传文档：成功后刷新文档列表（向量化在后台进行） */
  const handleUploadDocument = async (options: any) => {
    const { file, onSuccess, onError } = options
    try {
      await uploadDocument(selectedKb.id, file)
      message.success('文档上传成功，正在后台处理向量化...')
      const updatedKb = await fetchKnowledgeBaseById(selectedKb.id)
      setDocuments(updatedKb.documents || [])
      onSuccess()
    } catch (error) {
      message.error((error as any)?.response?.data?.message || '上传失败，请重试')
      onError(error)
    }
  }

  /** 删除文档：成功后刷新列表 */
  const handleDeleteDocument = async (documentId: string) => {
    try {
      await deleteDocument(documentId); message.success('文档删除成功')
      const updatedKb = await fetchKnowledgeBaseById(selectedKb.id)
      setDocuments(updatedKb.documents || [])
    } catch { message.error('删除失败，请重试') }
  }

  /** 查看文档分块：拉取分块数据并在弹窗中预览 */
  const handleViewChunks = async (doc: any) => {
    setChunkDocName(doc.name); setChunks([]); setChunkModalVisible(true); setChunksLoading(true)
    try { const result = await fetchDocumentChunks(doc.id); setChunks(result.chunks || []) }
    catch { message.error('获取分块失败') }
    finally { setChunksLoading(false) }
  }

  /** 文档表格列：桌面端固定列宽，文件名在稳定宽度内省略并可查看全文 */
  const documentColumns = [
    {
      title: '文件名', dataIndex: 'name', key: 'name', width: 260,
      render: (name: string) => (
        <div className="doc-file-cell">
          <FileTextOutlined aria-hidden="true" />
          <Tooltip title={name}>
            <span className="doc-file-name" tabIndex={0}>{name}</span>
          </Tooltip>
        </div>
      ),
    },
    { title: '大小', dataIndex: 'size', key: 'size', width: 92, render: formatFileSize },
    { title: '状态', dataIndex: 'status', key: 'status', width: 88, render: renderDocumentStatus },
    { title: '上传时间', dataIndex: 'createdAt', key: 'createdAt', width: 168, render: (time: string) => new Date(time).toLocaleString('zh-CN') },
    {
      title: '操作', key: 'action', width: 132,
      render: (_: unknown, record: KnowledgeDocument & { status?: string }) => (
        <Space size="small" className="doc-table-actions">
          <Button
            icon={<BlockOutlined />}
            size="small"
            type="text"
            disabled={record.status === 'processing'}
            title={record.status === 'processing' ? '文档处理完成后可查看分块' : undefined}
            onClick={() => handleViewChunks(record)}
            className="action-btn"
          >
            分块
          </Button>
          <Button aria-label={`删除文档 ${record.name}`} icon={<DeleteOutlined />} size="small" danger type="text" onClick={() => handleDeleteDocument(record.id)} loading={ragLoading} className="action-btn" />
        </Space>
      ),
    },
  ]

  /** 知识库表格列定义 */
  const kbColumns = [
    {
      title: '知识库名称', dataIndex: 'name', key: 'name',
      render: (text: string, record: any) => (
        <div className="kb-table-name">
          <div className="kb-table-icon"><BookOutlined /></div>
          <div>
            <Text strong style={{ color: 'var(--c-text-primary)' }}>{text}</Text>
            <div className="kb-table-desc">{record.description || '暂无描述'}</div>
          </div>
        </div>
      ),
    },
    {
      title: '检索模式', dataIndex: 'retrievalMode', key: 'retrievalMode', width: 110,
      render: (mode: string) => {
        const opt = RETRIEVAL_MODE_OPTIONS.find((o) => o.value === mode) || RETRIEVAL_MODE_OPTIONS[0]
        return <Tag color={opt.color === '#1677ff' ? 'blue' : opt.color === '#52c41a' ? 'green' : 'cyan'} style={{ margin: 0 }}>{opt.label}</Tag>
      },
    },
    {
      title: '向量配置', key: 'vectorConfig', width: 160,
      render: (_: any, record: any) => {
        const providerLabels: Record<string, string> = { qwen: 'Qwen', openai: 'OpenAI', ollama: 'Ollama' }
        const storeLabels: Record<string, string> = { pgvector: 'pgvector', qdrant: 'Qdrant', milvus: 'Milvus' }
        const provider = record.embeddingProvider || 'qwen'
        const store = record.vectorStore || 'pgvector'
        return (
          <Space size={4}>
            <Tag color="blue" style={{ fontSize: 11, margin: 0 }}>{providerLabels[provider] || provider}</Tag>
            <Tag color="green" style={{ fontSize: 11, margin: 0 }}>{storeLabels[store] || store}</Tag>
          </Space>
        )
      },
    },
    {
      title: '重排序', key: 'reranker', width: 90,
      render: (_: any, record: any) => {
        if (!record.rerankerEnabled || record.rerankerProvider === 'none') {
          return <Tag style={{ fontSize: 11, margin: 0, color: '#8c8c8c' }}>关闭</Tag>
        }
        const rerankerLabels: Record<string, string> = { cohere: 'Cohere', ollama: 'Ollama' }
        const color = record.rerankerProvider === 'cohere' ? 'blue' : 'green'
        return <Tag color={color} style={{ fontSize: 11, margin: 0 }}>{rerankerLabels[record.rerankerProvider] || record.rerankerProvider}</Tag>
      },
    },
    {
      title: '文档数量', key: 'documentCount', width: 90,
      render: (_: any, record: any) => <span className="kb-doc-count">{(record.documents || []).length} 份</span>,
    },
    {
      title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 120,
      render: (time: string) => <Text style={{ color: 'var(--c-text-secondary)', fontSize: 13 }}>{new Date(time).toLocaleDateString('zh-CN')}</Text>,
    },
    {
      title: '操作', key: 'action', width: 224, fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space size={8} className="kb-table-actions">
          <Button icon={<FolderOpenOutlined />} size="small" className="action-btn action-btn--docs" onClick={() => handleViewDocuments(record)}>管理文档</Button>
          <Button icon={<EditOutlined />} size="small" type="text" className="action-btn" onClick={() => handleEditKb(record)} />
          <Button danger icon={<DeleteOutlined />} size="small" type="text" className="action-btn action-btn--danger" onClick={() => handleDeleteKb(record.id)} />
        </Space>
      ),
    },
  ]

  return (
    <div className="kb-page">
      <div className="kb-page-header">
        <div>
          <h2 className="kb-page-title">知识库</h2>
          <p className="kb-page-desc">管理文档资产，为 RAG 节点提供稳定可靠的检索素材。</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddKb}>新建知识库</Button>
      </div>

      <div className="kb-stats-row">
        <div className="kb-stat-card">
          <span className="kb-stat-label">知识库总数</span>
          <span className="kb-stat-value">{safeKnowledgeBases.length}</span>
        </div>
        <div className="kb-stat-card">
          <span className="kb-stat-label">文档总量</span>
          <span className="kb-stat-value kb-stat-value--blue">{totalDocuments}</span>
        </div>
      </div>

      <div className="kb-table-card">
        {safeKnowledgeBases.length > 0 ? (
          <Table
            columns={kbColumns}
            dataSource={safeKnowledgeBases}
            rowKey="id"
            loading={ragLoading}
            scroll={{ x: 1000 }}
            pagination={{ pageSize: 8, size: 'small' }}
          />
        ) : (
          <Empty description="还没有知识库，创建一个来上传文档吧" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '48px 0' }} />
        )}
      </div>

      {/* Create / Edit Modal */}
      <Modal
        title={editingKb ? '编辑知识库' : '新建知识库'}
        open={modalVisible} onOk={handleSaveKb} onCancel={() => setModalVisible(false)}
        confirmLoading={ragLoading} okText={editingKb ? '保存修改' : '创建知识库'} cancelText="取消" width={560}
        okButtonProps={{ style: { background: 'var(--c-accent)', borderColor: 'var(--c-accent)' } }}
      >
        <div className="kb-modal-fields">
          <div className="kb-field">
            <label className="kb-field-label">知识库名称</label>
            <Input placeholder="给知识库起个名字" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
          </div>
          <div className="kb-field">
            <label className="kb-field-label">描述（可选）</label>
            <TextArea placeholder="这个知识库的用途，例如：产品手册、FAQ、SOP" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} />
          </div>

          <Divider orientation="left" style={{ fontSize: 13, color: 'var(--c-text-secondary)' }}>
            <SettingOutlined /> 高级配置
          </Divider>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="kb-field">
              <label className="kb-field-label"><RobotOutlined /> Embedding 服务</label>
              <Select value={formData.embeddingProvider} onChange={(val: EmbeddingProviderType) => {
                const models = EMBEDDING_MODELS[val]
                const defaultModel = models[0]
                setFormData({
                  ...formData,
                  embeddingProvider: val,
                  embeddingModel: defaultModel.value,
                  embeddingDimension: defaultModel.dimension,
                })
              }} style={{ width: '100%' }}
                loading={modelCatalogLoading}
                options={([
                  { label: '通义千问 (Qwen)', value: 'qwen' },
                  { label: 'OpenAI-compatible', value: 'openai' },
                  { label: 'Ollama (本地)', value: 'ollama' },
                ] as Array<{ label: string; value: EmbeddingProviderType }>).map((option) => ({
                  ...option,
                  disabled: !availableProviders.includes(option.value as any) && option.value !== formData.embeddingProvider,
                  label: !availableProviders.includes(option.value as any) ? `${option.label}（凭证未配置/不可用）` : option.label,
                }))}
              />
              {availableProviders.length === 0 && !modelCatalogLoading && (
                <Button type="link" size="small" style={{ paddingInline: 0 }} onClick={() => navigate('/model-settings')}>
                  先配置模型服务
                </Button>
              )}
            </div>
            <div className="kb-field">
              <label className="kb-field-label"><CloudServerOutlined /> 向量存储</label>
              <Select value={formData.vectorStore} onChange={(val: VectorStoreType) => setFormData({ ...formData, vectorStore: val })} style={{ width: '100%' }}
                options={VECTOR_STORE_OPTIONS.map((opt) => ({
                  label: <Tooltip title={opt.description}><span>{opt.label}</span></Tooltip>,
                  value: opt.value,
                }))}
              />
            </div>
            <div className="kb-field">
              <label className="kb-field-label"><SearchOutlined /> 检索模式</label>
              <Select value={formData.retrievalMode} onChange={(val: 'vector' | 'keyword' | 'hybrid') => setFormData({ ...formData, retrievalMode: val })} style={{ width: '100%' }}
                options={RETRIEVAL_MODE_OPTIONS.map((opt) => ({
                  label: <Tooltip title={opt.description}><span style={{ color: opt.color }}>{opt.label}</span></Tooltip>,
                  value: opt.value,
                }))}
              />
            </div>
            <div className="kb-field">
              <label className="kb-field-label">Embedding 模型</label>
              <Select value={formData.embeddingModel} onChange={(val) => {
                const models = EMBEDDING_MODELS[formData.embeddingProvider]
                const selected = models.find((m) => m.value === val)
                setFormData({ ...formData, embeddingModel: val, embeddingDimension: selected?.dimension || 1024 })
              }} style={{ width: '100%' }}
                options={EMBEDDING_MODELS[formData.embeddingProvider].map((m) => ({
                  label: m.label,
                  value: m.value,
                }))}
              />
            </div>
            <div className="kb-field">
              <label className="kb-field-label">向量维度</label>
              <Select value={formData.embeddingDimension} onChange={(val) => setFormData({ ...formData, embeddingDimension: val })} style={{ width: '100%' }}
                options={[formData.embeddingDimension].map((d) => ({ label: `${d}`, value: d }))}
              />
            </div>
            <div className="kb-field">
              <label className="kb-field-label">TopK</label>
              <InputNumber value={formData.topK} onChange={(val) => setFormData({ ...formData, topK: val || 5 })} min={1} max={20} style={{ width: '100%' }} />
            </div>
            <div className="kb-field">
              <label className="kb-field-label">分块大小: {formData.chunkSize}</label>
              <Slider value={formData.chunkSize} onChange={(val) => setFormData({ ...formData, chunkSize: val })} min={100} max={2000} step={50} />
            </div>
            <div className="kb-field">
              <label className="kb-field-label">分块重叠: {formData.chunkOverlap}</label>
              <Slider value={formData.chunkOverlap} onChange={(val) => setFormData({ ...formData, chunkOverlap: val })} min={0} max={500} step={10} />
            </div>
            <div className="kb-field" style={{ gridColumn: '1 / -1' }}>
              <label className="kb-field-label">相似度阈值: {formData.similarityThreshold}</label>
              <Slider value={formData.similarityThreshold} onChange={(val) => setFormData({ ...formData, similarityThreshold: val })} min={0} max={1} step={0.05} marks={{ 0: '0', 0.5: '0.5', 0.7: '0.7', 1: '1.0' }} />
            </div>
            {formData.retrievalMode === 'hybrid' && (
              <>
                <div className="kb-field" style={{ gridColumn: '1 / -1' }}>
                  <Divider orientation="left" style={{ fontSize: 12, color: 'var(--c-text-secondary)', margin: '8px 0' }}>
                    <ExperimentOutlined /> 混合检索配置
                  </Divider>
                </div>
                <div className="kb-field">
                  <label className="kb-field-label">
                    向量检索权重: {formData.vectorWeight}
                    <Tooltip title="向量检索在融合中的权重，关键词权重 = 1 - 向量权重。默认 0.7 偏向语义匹配。">
                      <InfoCircleOutlined style={{ marginLeft: 4, fontSize: 12, color: 'var(--c-text-tertiary)' }} />
                    </Tooltip>
                  </label>
                  <Slider value={formData.vectorWeight} onChange={(val) => setFormData({ ...formData, vectorWeight: val })} min={0} max={1} step={0.05} marks={{ 0: '关键词', 0.5: '均衡', 0.7: '0.7', 1: '向量' }} />
                </div>
                <div className="kb-field">
                  <label className="kb-field-label">
                    RRF 常数 K: {formData.rrfK}
                    <Tooltip title="Reciprocal Rank Fusion 常数，增大则低排名结果影响增大（更平等），减小则偏向头部。学术推荐值 60。">
                      <InfoCircleOutlined style={{ marginLeft: 4, fontSize: 12, color: 'var(--c-text-tertiary)' }} />
                    </Tooltip>
                  </label>
                  <Slider value={formData.rrfK} onChange={(val) => setFormData({ ...formData, rrfK: val })} min={1} max={200} step={1} marks={{ 1: '1', 60: '60', 100: '100', 200: '200' }} />
                </div>
              </>
            )}
            {/* Phase 2.3: Reranker 配置 */}
            <div className="kb-field" style={{ gridColumn: '1 / -1' }}>
              <Divider orientation="left" style={{ fontSize: 12, color: 'var(--c-text-secondary)', margin: '8px 0' }}>
                <ExperimentOutlined /> 重排序配置 (Reranker)
              </Divider>
            </div>
            <div className="kb-field">
              <label className="kb-field-label">
                  <Switch
                  size="small"
                  checked={formData.rerankerEnabled}
                  disabled={!availableProviders.includes('ollama')}
                  onChange={(checked) => setFormData({ ...formData, rerankerEnabled: checked, rerankerProvider: checked ? 'ollama' : 'none', rerankerModel: checked ? 'bge-reranker-v2-m3' : '' })}
                />
                <span style={{ marginLeft: 8 }}>启用重排序</span>
                <Tooltip title="检索后对候选文档重排序，提高 Top-K 精度。推荐混合检索 + Reranker 组合使用。">
                  <InfoCircleOutlined style={{ marginLeft: 4, fontSize: 12, color: 'var(--c-text-tertiary)' }} />
                </Tooltip>
              </label>
            </div>
            {formData.rerankerEnabled && (
              <>
                {formData.rerankerProvider === 'cohere' && (
                  <div className="kb-field" style={{ gridColumn: '1 / -1' }}>
                    <Alert type="warning" showIcon message="已有 Cohere 配置会被保留，但当前用户凭证功能暂不支持调用 Cohere。" />
                  </div>
                )}
                <div className="kb-field">
                  <label className="kb-field-label">Reranker 服务</label>
                  <Select value={formData.rerankerProvider} onChange={(val: RerankerProviderType) => {
                    setFormData({ ...formData, rerankerProvider: val, rerankerModel: val === 'ollama' ? 'bge-reranker-v2-m3' : '' })
                  }} style={{ width: '100%' }}
                    options={[{ label: 'Ollama（复用当前用户配置）', value: 'ollama' }]}
                  />
                </div>
                <div className="kb-field">
                  <label className="kb-field-label">Reranker 模型</label>
                  <Select value={formData.rerankerModel || undefined} onChange={(val) => setFormData({ ...formData, rerankerModel: val })} style={{ width: '100%' }}
                    options={OLLAMA_RERANK_MODELS.map((m) => ({ label: m.label, value: m.value }))}
                    placeholder="选择模型"
                  />
                </div>
                <div className="kb-field">
                  <label className="kb-field-label">
                    重排序 TopN: {formData.rerankerTopN}
                    <Tooltip title="重排序后返回的文档数量，建议与 TopK 一致或更小以减少 LLM 上下文长度。">
                      <InfoCircleOutlined style={{ marginLeft: 4, fontSize: 12, color: 'var(--c-text-tertiary)' }} />
                    </Tooltip>
                  </label>
                  <Slider value={formData.rerankerTopN} onChange={(val) => setFormData({ ...formData, rerankerTopN: val })} min={1} max={20} step={1} marks={{ 1: '1', 5: '5', 10: '10', 20: '20' }} />
                </div>
              </>
            )}
          </div>
        </div>
      </Modal>

      {/* Document Management Modal */}
      <Modal
        title={<div className="doc-modal-title"><DatabaseOutlined /><span>{selectedKb?.name} · 文档管理</span></div>}
        open={documentModalVisible} onCancel={() => setDocumentModalVisible(false)} width={880} footer={null}
      >
        <div className="doc-modal-body">
          <Dragger name="file" multiple={false} customRequest={handleUploadDocument} showUploadList={false} className="doc-dragger">
            <p className="ant-upload-drag-icon" style={{ marginBottom: 10 }}><InboxOutlined style={{ fontSize: 28, color: 'var(--c-accent)' }} /></p>
            <p className="doc-dragger-text">拖拽文件到此处，或点击上传</p>
            <p className="doc-dragger-hint">支持 txt、md、pdf、docx 等格式，上传后即可用于 RAG 检索</p>
          </Dragger>
          <div className="doc-list-section">
            <div className="doc-list-header">
              <Text strong>已上传文档</Text>
              <Text style={{ color: 'var(--c-text-secondary)', fontSize: 13 }}>{documents.length ? `共 ${documents.length} 份` : '暂无文档'}</Text>
            </div>
            {documents.length === 0 ? (
              <Empty description="上传第一份文档后将在这里显示" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <>
                <div className="doc-table-view">
                  <Table
                    columns={documentColumns}
                    dataSource={documents}
                    rowKey="id"
                    pagination={false}
                    size="small"
                    tableLayout="fixed"
                    scroll={{ x: 740 }}
                  />
                </div>
                <div className="doc-mobile-list">
                  {documents.map((document) => (
                    <article className="doc-mobile-card" key={document.id}>
                      <div className="doc-file-cell">
                        <FileTextOutlined aria-hidden="true" />
                        <Tooltip title={document.name}>
                          <span className="doc-file-name" tabIndex={0}>{document.name}</span>
                        </Tooltip>
                      </div>
                      <dl className="doc-mobile-meta">
                        <div><dt>大小</dt><dd>{formatFileSize(document.size)}</dd></div>
                        <div><dt>状态</dt><dd>{renderDocumentStatus(document.status)}</dd></div>
                        <div className="doc-mobile-date"><dt>上传时间</dt><dd>{new Date(document.createdAt).toLocaleString('zh-CN')}</dd></div>
                      </dl>
                      <div className="doc-mobile-actions">
                        <Button
                          icon={<BlockOutlined />}
                          disabled={document.status === 'processing'}
                          title={document.status === 'processing' ? '文档处理完成后可查看分块' : undefined}
                          onClick={() => handleViewChunks(document)}
                        >
                          查看分块
                        </Button>
                        <Button danger icon={<DeleteOutlined />} onClick={() => handleDeleteDocument(document.id)} loading={ragLoading}>删除</Button>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </Modal>

      {/* Chunk Preview Modal */}
      <Modal
        title={<div className="chunk-modal-title"><button type="button" aria-label="返回文档列表" className="chunk-back-btn" onClick={() => setChunkModalVisible(false)}><ArrowLeftOutlined /></button><BlockOutlined /><span>文档分块预览</span><span className="chunk-doc-name" title={chunkDocName}>{chunkDocName}</span></div>}
        open={chunkModalVisible} onCancel={() => setChunkModalVisible(false)} width={720} footer={null}
      >
        <div className="chunk-modal-body">
          {chunksLoading ? (
            <div className="chunk-loading"><Spin size="large" /><Text style={{ color: 'var(--c-text-secondary)', marginTop: 12 }}>正在加载分块数据…</Text></div>
          ) : chunks.length > 0 ? (
            <><div className="chunk-summary">共 <strong>{chunks.length}</strong> 个分块</div><div className="chunk-list">{chunks.map((chunk, idx) => (<div key={chunk.id} className="chunk-card"><div className="chunk-card-header"><span className="chunk-index">#{idx + 1}</span><span className="chunk-meta">{chunk.content.length} 字符</span></div><pre className="chunk-content">{chunk.content}</pre></div>))}</div></>
          ) : (
            <Empty description="该文档暂无分块数据" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '48px 0' }} />
          )}
        </div>
      </Modal>
    </div>
  )
}

export default KnowledgeBase
