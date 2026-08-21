/**
 * 前端全局类型定义：集中管理所有业务实体、表单与配置选项。
 *
 * 涵盖用户/应用/工作流/知识库/技能/模板/团队/API Key/分享等
 * 各功能域的类型与下拉选项常量，是全站类型共享的唯一来源。
 */

// ============ 用户相关类型 ============

/** 用户实体 */
export interface User {
  id: string
  username: string
  avatar?: string
  createdAt: string
}

/** 登录表单 */
export interface LoginForm {
  username: string
  password: string
}

/** 注册表单 */
export interface RegisterForm {
  username: string
  password: string
}

// ============ 应用相关类型 ============

/** 应用实体：状态为草稿/已发布/已归档 */
export interface Application {
  id: string
  name: string
  description?: string
  icon?: string
  status: 'draft' | 'published' | 'archived'
  shareLink?: string
  createdAt: string
  updatedAt: string
}

/** 创建应用表单 */
export interface CreateAppForm {
  name: string
  description?: string
  icon?: string
}

// ============ 工作流相关类型 ============

/** 画布节点类型（与后端节点执行器一一对应） */
export type NodeType = 'start' | 'userInput' | 'llm' | 'rag' | 'skill' | 'condition' | 'output' | 'agent'

/** 节点数据的公共基类 */
export interface BaseNodeData {
  label: string
  [key: string]: unknown
}

/** 开始节点：声明一组可直接注入的静态变量 */
export interface StartNodeData extends BaseNodeData {
  variables: { key: string; value: any }[]
}

/** 用户输入节点：声明需要外部传入的输入字段 */
export interface UserInputNodeData extends BaseNodeData {
  inputField: string
}

/** 大模型节点：模型、提示词与生成参数 */
export interface LLMNodeData extends BaseNodeData {
  provider: 'qwen' | 'openai' | 'ollama'
  model: string
  systemPrompt: string
  userPrompt: string
  temperature: number
  maxTokens: number
}

/** 知识库检索节点：指定知识库与检索参数 */
export interface RAGNodeData extends BaseNodeData {
  knowledgeBaseId: string
  query: string
  topK: number
  similarityThreshold: number
}

/** 技能调用节点：指定技能 ID 与入参 */
export interface SkillNodeData extends BaseNodeData {
  skillId: string
  skillType: 'builtin' | 'custom'
  parameters: Record<string, any>
}

/** 条件分支节点：一组"变量 + 运算符 + 值"的条件列表 */
export interface ConditionNodeData extends BaseNodeData {
  conditions: { variable: string; operator: string; value: any }[]
}

/** 输出节点：定义输出表达式 */
export interface OutputNodeData extends BaseNodeData {
  outputValue: any
}

/** Agent 模式类型 */
export type AgentMode = 'single' | 'supervisor'

/** Agent 执行策略 */
export type AgentStrategy = 'react' | 'plan-and-execute' | 'reflection'

/** Worker Agent 配置 */
export interface WorkerConfig {
  id: string
  name: string
  description: string
  systemPrompt: string
  provider: 'qwen' | 'openai' | 'ollama'
  model: string
  temperature: number
  maxTokens: number
  toolIds: string[]
  knowledgeBaseIds: string[]
  ragEnabled: boolean
}

/** Agent 节点数据 */
export interface AgentNodeData extends BaseNodeData {
  /** Agent 模式: single / supervisor */
  agentMode: AgentMode
  /** 执行策略 */
  strategy: AgentStrategy
  /** 模型 */
  provider: 'qwen' | 'openai' | 'ollama'
  model: string
  /** 系统提示词 */
  systemPrompt: string
  /** 用户提示词 */
  userPrompt: string
  /** 温度 */
  temperature: number
  /** 最大 Token */
  maxTokens: number
  /** 最大迭代轮数 */
  maxIterations: number
  /** 工具 ID 列表 */
  toolIds: string[]
  /** 知识库 ID 列表 */
  knowledgeBaseIds: string[]
  /** 是否启用 RAG */
  ragEnabled: boolean
  /** 是否启用记忆 */
  memoryEnabled: boolean
  /** 记忆窗口大小 */
  memoryWindowSize: number
  /** Supervisor 模式专用 */
  supervisorPrompt?: string
  /** Worker 列表 (supervisor 模式) */
  workers?: WorkerConfig[]
}

/** 所有节点数据的联合类型（按节点 type 区分） */
export type WorkflowNodeData =
  | StartNodeData
  | UserInputNodeData
  | LLMNodeData
  | RAGNodeData
  | SkillNodeData
  | ConditionNodeData
  | OutputNodeData
  | AgentNodeData

/** 画布节点：位置 + 类型 + 配置数据 */
export interface WorkflowNode {
  id: string
  type: NodeType
  position: { x: number; y: number }
  data: WorkflowNodeData
}

/** 画布连线 */
export interface WorkflowEdge {
  id: string
  source: string
  target: string
  label?: string
}

/** 工作流实体：名称、节点、连线与可选全局变量 */
export interface Workflow {
  id: string
  name: string
  description?: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  variables?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

// ============ 知识库相关类型 ============

/** Embedding Provider 类型 */
export type EmbeddingProviderType = 'qwen' | 'openai' | 'ollama'

/** 向量存储后端类型 */
export type VectorStoreType = 'pgvector' | 'qdrant' | 'milvus'

/** Embedding 模型选项 */
export const EMBEDDING_MODELS: Record<EmbeddingProviderType, { label: string; value: string; dimension: number }[]> = {
  qwen: [
    { label: 'text-embedding-v3 (1024维)', value: 'text-embedding-v3', dimension: 1024 },
    { label: 'text-embedding-v2 (1536维)', value: 'text-embedding-v2', dimension: 1536 },
    { label: 'text-embedding-v1 (768维)', value: 'text-embedding-v1', dimension: 768 },
  ],
  openai: [
    { label: 'text-embedding-3-small (1536维)', value: 'text-embedding-3-small', dimension: 1536 },
    { label: 'text-embedding-3-large (3072维)', value: 'text-embedding-3-large', dimension: 3072 },
    { label: 'text-embedding-ada-002 (1536维)', value: 'text-embedding-ada-002', dimension: 1536 },
  ],
  ollama: [
    { label: 'nomic-embed-text (768维)', value: 'nomic-embed-text', dimension: 768 },
    { label: 'mxbai-embed-large (1024维)', value: 'mxbai-embed-large', dimension: 1024 },
    { label: 'all-minilm (384维)', value: 'all-minilm', dimension: 384 },
    { label: 'bge-m3 (1024维)', value: 'bge-m3', dimension: 1024 },
  ],
}

/** 向量存储选项 */
export const VECTOR_STORE_OPTIONS: { label: string; value: VectorStoreType; description: string }[] = [
  { label: 'pgvector', value: 'pgvector', description: 'PostgreSQL + pgvector 扩展（默认，无需额外部署）' },
  { label: 'Qdrant', value: 'qdrant', description: '高性能向量数据库（适合大规模检索）' },
  { label: 'Milvus', value: 'milvus', description: '分布式向量数据库（适合亿级向量）' },
]

/** Reranker Provider 类型 */
export type RerankerProviderType = 'cohere' | 'ollama' | 'none'

/** 知识库实体：embedding/向量库/分块/检索模式/重排序等完整配置 */
export interface KnowledgeBase {
  id: string
  name: string
  description?: string
  type?: string
  embeddingProvider: EmbeddingProviderType
  embeddingModel: string
  embeddingDimension: number
  vectorStore: VectorStoreType
  chunkSize: number
  chunkOverlap: number
  topK: number
  similarityThreshold: number
  retrievalMode: 'vector' | 'keyword' | 'hybrid'
  vectorWeight: number
  rrfK: number
  // Phase 2.3: Reranker 配置
  rerankerEnabled: boolean
  rerankerProvider: RerankerProviderType
  rerankerModel: string
  rerankerTopN?: number
  userId: string
  createdAt: string
  updatedAt: string
  documents?: Document[]
}

/** 检索模式选项 */
export const RETRIEVAL_MODE_OPTIONS: { label: string; value: KnowledgeBase['retrievalMode']; description: string; color: string }[] = [
  { label: '向量检索', value: 'vector', description: '语义匹配，适合同义词、语义关联场景', color: '#1677ff' },
  { label: '关键词检索', value: 'keyword', description: 'BM25 精确匹配，适合专有名词、编号场景', color: '#52c41a' },
  { label: '混合检索', value: 'hybrid', description: '向量+关键词 RRF 融合，推荐生产使用', color: '#722ed1' },
]

/** Reranker Provider 选项 */
export const RERANKER_PROVIDER_OPTIONS: { label: string; value: RerankerProviderType; description: string; color: string }[] = [
  { label: '不使用', value: 'none', description: '不使用重排序，返回原始检索结果', color: '#8c8c8c' },
  { label: 'Cohere Rerank', value: 'cohere', description: '业界最强重排序 API，支持多语言（需 API Key）', color: '#1677ff' },
  { label: 'Ollama 本地', value: 'ollama', description: '本地部署重排序模型，零 API 成本，数据不出服务器', color: '#52c41a' },
]

/** Cohere Reranker 可选模型 */
export const COHERE_RERANK_MODELS = [
  { label: 'rerank-v3.5（推荐）', value: 'rerank-v3.5' },
  { label: 'rerank-english-v3.0（英文）', value: 'rerank-english-v3.0' },
  { label: 'rerank-multilingual-v3.0（多语言）', value: 'rerank-multilingual-v3.0' },
]

/** Ollama Reranker 可选模型 */
export const OLLAMA_RERANK_MODELS = [
  { label: 'bge-reranker-v2-m3（推荐，多语言）', value: 'bge-reranker-v2-m3' },
  { label: 'bge-reranker-v2-gemma（更高精度）', value: 'bge-reranker-v2-gemma' },
]

/** 文档实体（属于某个知识库） */
export interface Document {
  id: string
  name: string
  size: number
  filePath?: string
  knowledgeBaseId: string
  createdAt: string
  updatedAt: string
}

/** 文档分块结果 */
export interface DocumentChunk {
  id: string
  content: string
  chunkIndex: number
  startIndex: number
  endIndex: number
  metadata?: string
  createdAt: string
}

/** 文档分块查询响应 */
export interface DocumentChunksResponse {
  documentId: string
  documentName: string
  totalChunks: number
  chunks: DocumentChunk[]
}

// ============ 技能（Skill）相关类型 ============

/** 技能实体：内置或自定义，含输入输出 schema */
export interface Skill {
  id: string
  name: string
  description?: string
  type: 'builtin' | 'custom'
  builtinType?: string
  config?: Record<string, unknown>
  inputSchema?: Record<string, unknown>
  outputSchema?: Record<string, unknown>
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// ============ 节点执行状态 ============

/** 节点运行状态：待运行/运行中/成功/失败 */
export type NodeExecutionStatus = 'pending' | 'running' | 'success' | 'failed'

/** 单个节点的一次执行结果（用于画布运行态高亮） */
export interface NodeExecution {
  nodeId: string
  status: NodeExecutionStatus
  inputs?: Record<string, unknown>
  outputs?: Record<string, unknown>
  error?: string
  startedAt?: string
  completedAt?: string
}

// ============ 模板市场相关类型 ============

/** 模板分类 */
export type TemplateCategory = 'productivity' | 'customer-service' | 'content-creation' | 'data-analysis' | 'education' | 'development' | 'other'

/** 模板排序方式：最新/热门/评分 */
export type TemplateSort = 'newest' | 'popular' | 'rating'

/** 模板状态：草稿/已发布/已归档 */
export type TemplateStatus = 'draft' | 'published' | 'archived'

/** 工作流模板实体：含完整节点连线与市场统计 */
export interface WorkflowTemplate {
  id: string
  name: string
  description?: string
  icon?: string
  screenshot?: string
  category: TemplateCategory
  tags: string[]
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  variables?: Record<string, unknown> | null
  downloadCount: number
  rating: number
  ratingCount: number
  status: TemplateStatus
  isOfficial: boolean
  userId: string
  createdAt: string
  updatedAt: string
}

/** 模板列表分页响应 */
export interface TemplateListResponse {
  items: WorkflowTemplate[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/** 模板分类计数（用于市场侧栏筛选） */
export interface TemplateCategoryCount {
  category: TemplateCategory
  count: number
}

/** 模板分类选项 */
export const TEMPLATE_CATEGORY_OPTIONS: { label: string; value: TemplateCategory }[] = [
  { label: '生产力', value: 'productivity' },
  { label: '客服', value: 'customer-service' },
  { label: '内容创作', value: 'content-creation' },
  { label: '数据分析', value: 'data-analysis' },
  { label: '教育', value: 'education' },
  { label: '开发', value: 'development' },
  { label: '其他', value: 'other' },
]

// ============ 团队与权限（RBAC） ============

/** 团队角色：所有者/管理员/编辑者/查看者 */
export type TeamRole = 'owner' | 'admin' | 'editor' | 'viewer'
/** 团队内应用的访问权限 */
export type TeamAppPermission = 'full_access' | 'can_edit' | 'can_view'
/** 全局角色 */
export type GlobalRole = 'admin' | 'member'
/** API Key 的权限范围 */
export type ApiKeyScope = 'app:read' | 'app:write' | 'app:execute' | 'workflow:read' | 'workflow:write' | 'knowledge:read' | 'knowledge:write'

/** 团队实体 */
export interface Team {
  id: string
  name: string
  description?: string
  avatar?: string
  ownerId: string
  createdAt: string
  updatedAt: string
  memberCount?: number
  members?: TeamMember[]
  applications?: TeamApplication[]
}

/** 团队成员 */
export interface TeamMember {
  id: string
  teamId: string
  userId: string
  role: TeamRole
  joinedAt: string
  user?: User
}

/** 团队内的应用授权 */
export interface TeamApplication {
  id: string
  teamId: string
  applicationId: string
  permission: TeamAppPermission
  addedAt: string
  application?: any
}

/** API Key（列表中展示，不包含完整密钥） */
export interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  scopes: ApiKeyScope[]
  isActive: boolean
  lastUsedAt?: string
  expiresAt?: string
  createdAt: string
}

/** 创建 API Key 的响应：完整 key 仅在此返回一次 */
export interface ApiKeyCreatedResponse {
  id: string
  name: string
  key: string
  keyPrefix: string
  createdAt: string
}

/** 应用分享配置 */
export interface AppShare {
  id: string
  applicationId: string
  shareLink: string
  isPublic: boolean
  accessCount: number
  embedConfig?: EmbedConfig
  createdAt: string
}

/** 嵌入（iframe/script）配置 */
export interface EmbedConfig {
  enabled: boolean
  width?: string
  height?: string
  theme?: 'light' | 'dark' | 'auto'
  showHeader?: boolean
}

// ============ 表单类型 ============

/** 创建团队表单 */
export interface CreateTeamForm {
  name: string
  description?: string
}

/** 添加成员表单 */
export interface AddMemberForm {
  userId: string
  role: TeamRole
}

/** 添加应用到团队的表单 */
export interface AddTeamAppForm {
  applicationId: string
  permission: TeamAppPermission
}

/** 创建 API Key 表单 */
export interface CreateApiKeyForm {
  name: string
  scopes: ApiKeyScope[]
  expiresAt?: string
}

/** 更新分享设置表单 */
export interface UpdateShareSettingsForm {
  isPublic?: boolean
  embedConfig?: EmbedConfig
}

// ============ 展示常量 ============

/** 团队角色的中文标签 */
export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  owner: '所有者',
  admin: '管理员',
  editor: '编辑者',
  viewer: '查看者',
}

/** 团队应用权限的中文标签 */
export const TEAM_APP_PERMISSION_LABELS: Record<TeamAppPermission, string> = {
  full_access: '完全访问',
  can_edit: '可编辑',
  can_view: '仅查看',
}

/** API Key 权限范围选项（供创建表单勾选） */
export const API_KEY_SCOPE_OPTIONS: { label: string; value: ApiKeyScope }[] = [
  { label: '应用读取', value: 'app:read' },
  { label: '应用写入', value: 'app:write' },
  { label: '应用执行', value: 'app:execute' },
  { label: '工作流读取', value: 'workflow:read' },
  { label: '工作流写入', value: 'workflow:write' },
  { label: '知识库读取', value: 'knowledge:read' },
  { label: '知识库写入', value: 'knowledge:write' },
]

// ============ 补充类型 ============

/** 更新团队表单 */
export interface UpdateTeamForm {
  name?: string
  description?: string
}

/** 更新成员角色表单 */
export interface UpdateMemberRoleForm {
  role: TeamRole
}

/** 更新团队应用权限表单 */
export interface UpdateTeamAppPermissionForm {
  permission: TeamAppPermission
}

/** 嵌入代码响应（iframe 与 script 两种方式） */
export interface EmbedCodeResponse {
  iframeCode: string
  scriptCode: string
}
