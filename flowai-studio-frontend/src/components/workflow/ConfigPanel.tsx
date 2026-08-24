/**
 * 节点配置面板：编辑画布中选中节点的详细参数。
 *
 * 按节点类型（start/llm/agent/rag/skill/condition/output）渲染
 * 不同的表单；所有修改通过 updateNodeData 实时同步回 store，
 * 因此画布与配置面板始终一致。
 *
 * 还包含 Agent 的 Supervisor/Worker 编辑、条件分支的可视化构建器、
 * 以及上游变量插入（VariableTextArea）等能力。
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Form, Input, Select, Slider, InputNumber, Switch, Divider, Card, Button, Space, Tag, Empty, Typography, AutoComplete, Alert, Tooltip } from 'antd'
import { PlusOutlined, DeleteOutlined, RobotOutlined, SettingOutlined, QuestionCircleOutlined, BranchesOutlined } from '@ant-design/icons'
import { useStore } from '../../store'
import { useNavigate } from 'react-router-dom'
import { inferLegacyProvider, useModelCatalog } from '../../utils/useModelCatalog'
import { ProviderModel, UserModelProvider } from '../../utils/modelCredentialApi'
import VariableTextArea from './VariableTextArea'
import { getAvailableVariables } from './variableUtils'

const { Option } = Select
const { Text } = Typography

/** 各节点类型的展示名称与说明（面板头部与空态提示使用） */
const NODE_TYPE_META: Record<string, { label: string; description: string }> = {
  start: { label: '开始节点', description: '定义工作流的起点和初始输入。' },
  userInput: { label: '用户输入', description: '收集用户问题或变量，作为后续节点输入。' },
  llm: { label: 'LLM 节点', description: '配置模型、提示词和生成参数。' },
  agent: { label: 'Agent 节点', description: '管理智能体模式、工具、记忆和执行策略。' },
  rag: { label: 'RAG 节点', description: '设置知识库检索范围和召回策略。' },
  skill: { label: '工具节点', description: '调用内置或自定义工具并传入参数。' },
  condition: { label: '条件节点', description: '根据判断逻辑决定工作流分支走向。' },
  output: { label: '输出节点', description: '组织最终返回给用户的结果。' },
}

/** 模型选择输入：支持从已加载模型中选择，也允许输入自定义模型 ID */
const ModelSelect: React.FC<{
  value?: string;
  onChange?: (value: string) => void;
  models: ProviderModel[];
  style?: React.CSSProperties;
  size?: 'small' | 'middle' | 'large';
}> = ({ value, onChange, models, style, size }) => (
  <AutoComplete
    value={value}
    onChange={onChange}
    style={style}
    size={size}
    placeholder="选择或输入模型 ID"
    options={[
      ...(value && !models.some((model) => model.id === value) ? [{ value, label: `${value}（自定义模型 ID）` }] : []),
      ...models.map((model) => ({ value: model.id, label: model.displayName })),
    ]}
    filterOption={(input, option) => String(option?.value || '').toLowerCase().includes(input.toLowerCase())}
  />
)

/** 模型供应商的中文/展示名 */
const PROVIDER_LABELS: Record<UserModelProvider, string> = {
  qwen: 'Qwen',
  openai: 'OpenAI-compatible',
  ollama: 'Ollama',
}

/** 条件分支支持的比较运算符选项 */
const CONDITION_OPERATOR_OPTIONS = [
  { value: 'contains', label: '包含' },
  { value: '===', label: '等于' },
  { value: '!==', label: '不等于' },
  { value: '>', label: '大于' },
  { value: '>=', label: '大于等于' },
  { value: '<', label: '小于' },
  { value: '<=', label: '小于等于' },
]

/** 把条件数据归一化为数组（兼容历史版本存 JSON 字符串的情况） */
const normalizeConditions = (conditions: unknown) => {
  if (Array.isArray(conditions)) return conditions
  if (typeof conditions !== 'string' || !conditions.trim()) return []

  try {
    const parsed = JSON.parse(conditions)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** 用户提示词字段的标签：带"什么是用户提示词"的说明气泡 */
const UserPromptLabel = () => (
  <span className="field-label-with-help">
    <span>用户提示词</span>
    <Tooltip
      trigger={['hover', 'focus']}
      title={(
        <span className="user-prompt-help-content">
          这是发送给大模型的输入。可以直接填写固定内容，也可以插入“用户输入”变量，
          并在变量前后补充润色、总结或回答要求。
        </span>
      )}
    >
      <button type="button" className="field-help-button" aria-label="查看用户提示词说明">
        <QuestionCircleOutlined aria-hidden="true" />
      </button>
    </Tooltip>
  </span>
)

/** 节点配置面板组件 */
const ConfigPanel: React.FC = () => {
  const navigate = useNavigate()
  const { availableProviders, modelsByProvider, loading: modelCatalogLoading } = useModelCatalog()
  const { selectedNode, nodes, edges, updateNodeData, knowledgeBases, fetchKnowledgeBases, skills, fetchSkills } = useStore()
  const [form] = Form.useForm()
  const initializedNodeKeyRef = useRef<string | null>(null)
  // Agent 的 Worker 列表单独用 state 管理（不属于 Form 字段）
  const [workers, setWorkers] = useState<any[]>([])
  // 监听表单中的 agentMode/provider，驱动条件渲染与模型列表
  const agentMode = Form.useWatch('agentMode', form) || 'single'
  const selectedProvider = (Form.useWatch('provider', form) || 'qwen') as UserModelProvider
  const supervisorProvider = (Form.useWatch('supervisorProvider', form) || selectedProvider) as UserModelProvider

  // 打开面板时加载知识库与技能列表（供 Agent/RAG/工具节点选择）
  useEffect(() => {
    fetchKnowledgeBases()
    fetchSkills()
  }, [fetchKnowledgeBases, fetchSkills])

  // 选中节点变化时，把节点数据回填到表单
  useEffect(() => {
    const nodeKey = selectedNode ? `${selectedNode.id}:${selectedNode.type}` : null
    if (initializedNodeKeyRef.current === nodeKey) return

    initializedNodeKeyRef.current = nodeKey
    form.resetFields()
    setWorkers([])

    if (selectedNode) {
      const data = selectedNode.data as any
      const normalizedConditions = selectedNode.type === 'condition'
        ? normalizeConditions(data.conditions)
        : data.conditions
      form.setFieldsValue({
        ...data,
        conditions: normalizedConditions,
        provider: data.provider || inferLegacyProvider(data.model),
        supervisorProvider: data.supervisorProvider || inferLegacyProvider(data.supervisorModel),
      })
      if (selectedNode.type === 'condition' && typeof data.conditions === 'string') {
        updateNodeData(selectedNode.id, { ...data, conditions: normalizedConditions })
      }
      if (selectedNode.type === 'agent' && (selectedNode.data as any).workers) {
        setWorkers(((selectedNode.data as any).workers || []).map((worker: any) => ({
          ...worker,
          provider: worker.provider || inferLegacyProvider(worker.model),
        })))
      }
    }
  }, [selectedNode, form, updateNodeData])

  /** 表单值变化：实时写回选中节点的数据 */
  const handleValuesChange = (changedValues: Record<string, unknown>) => {
    if (selectedNode) {
      updateNodeData(selectedNode.id, changedValues)
    }
  }

  // 当前选中节点的元信息与显示名
  const selectedNodeMeta = selectedNode ? NODE_TYPE_META[selectedNode.type] : null
  const selectedNodeName = selectedNode
    ? ((selectedNode.data as any)?.label || selectedNodeMeta?.label || '未命名节点')
    : ''
  // 当前节点可引用的上游变量
  const availableVariables = useMemo(
    () => selectedNode ? getAvailableVariables(nodes, edges, selectedNode.id) : [],
    [edges, nodes, selectedNode],
  )
  // 条件变量按节点分组（供条件构建器选择）
  const conditionVariableGroups = useMemo(() => {
    const groups = new Map<string, Array<{ label: string; value: string }>>()

    availableVariables.forEach((variable) => {
      const options = groups.get(variable.nodeLabel) || []
      options.push({
        label: `${variable.nodeLabel} · ${variable.fieldLabel}`,
        value: variable.token,
      })
      groups.set(variable.nodeLabel, options)
    })

    return [...groups.entries()].map(([label, options]) => ({ label, options }))
  }, [availableVariables])

  /** 添加一个 Worker：默认配置并同步到节点数据 */
  const addWorker = () => {
    const newWorker = {
      id: `worker_${Date.now()}`,
      name: `Worker ${workers.length + 1}`,
      description: '',
      systemPrompt: '',
      model: 'qwen-turbo',
      provider: 'qwen',
      temperature: 0.7,
      maxTokens: 2048,
      toolIds: [],
      knowledgeBaseIds: [],
      ragEnabled: false,
    }
    const updatedWorkers = [...workers, newWorker]
    setWorkers(updatedWorkers)
    if (selectedNode) {
      updateNodeData(selectedNode.id, { ...selectedNode.data, workers: updatedWorkers })
    }
  }

  /** 删除指定位置的 Worker */
  const removeWorker = (index: number) => {
    const updatedWorkers = workers.filter((_, i) => i !== index)
    setWorkers(updatedWorkers)
    if (selectedNode) {
      updateNodeData(selectedNode.id, { ...selectedNode.data, workers: updatedWorkers })
    }
  }

  /** 更新指定 Worker 的多个字段 */
  const updateWorkerFields = (index: number, patch: Record<string, any>) => {
    const updatedWorkers = workers.map((w, i) =>
      i === index ? { ...w, ...patch } : w
    )
    setWorkers(updatedWorkers)
    if (selectedNode) {
      updateNodeData(selectedNode.id, { ...selectedNode.data, workers: updatedWorkers })
    }
  }

  /** 更新指定 Worker 的单个字段 */
  const updateWorker = (index: number, field: string, value: any) => {
    updateWorkerFields(index, { [field]: value })
  }

  /** 生成供应商下拉选项：不可用的供应商标记"不可用"并禁用 */
  const providerOptions = (current?: UserModelProvider) => (
    (['qwen', 'openai', 'ollama'] as UserModelProvider[]).map((provider) => ({
      value: provider,
      label: availableProviders.includes(provider) ? PROVIDER_LABELS[provider] : `${PROVIDER_LABELS[provider]}（不可用）`,
      disabled: !availableProviders.includes(provider) && provider !== current,
    }))
  )

  /** 渲染 Agent 节点配置：基础字段 + 工具/知识库/记忆 + Supervisor/Worker */
  const renderAgentConfig = (commonFields: React.ReactNode) => {
    return (
      <>
        {commonFields}
        <Divider orientation="left" style={{ margin: '8px 0 12px' }}>
          <RobotOutlined /> Agent 基础配置
        </Divider>
        <Form.Item name="agentMode" label="Agent 模式" initialValue="single">
          <Select>
            <Option value="single">
              <Space><Tag color="blue">单智能体</Tag><Text type="secondary" style={{ fontSize: 12 }}>一个 Agent 完成所有任务</Text></Space>
            </Option>
            <Option value="supervisor">
              <Space><Tag color="blue">多智能体</Tag><Text type="secondary" style={{ fontSize: 12 }}>Supervisor 协调多个 Worker</Text></Space>
            </Option>
          </Select>
        </Form.Item>
        <Form.Item name="strategy" label="执行策略" initialValue="react">
          <Select>
            <Option value="react">ReAct (推理+行动)</Option>
            <Option value="plan-and-execute">Plan & Execute (规划+执行)</Option>
            <Option value="reflection">Reflection (反思优化)</Option>
          </Select>
        </Form.Item>
        <Form.Item name="provider" label="模型服务" initialValue="qwen">
          <Select loading={modelCatalogLoading} options={providerOptions(selectedProvider)} />
        </Form.Item>
        <Form.Item name="model" label="模型" initialValue="qwen-turbo">
          <ModelSelect models={modelsByProvider[selectedProvider]} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item className="variable-template-form-item" name="systemPrompt" label="系统提示词">
          <VariableTextArea
            rows={4}
            placeholder="定义 Agent 的角色、能力和行为规范"
            availableVariables={availableVariables}
            nodes={nodes}
            variableLabel="插入系统提示词变量"
          />
        </Form.Item>
        <Form.Item className="variable-template-form-item" name="userPrompt" label={<UserPromptLabel />} rules={[{ required: true }]}>
          <VariableTextArea
            rows={4}
            placeholder="输入交给智能体的内容"
            availableVariables={availableVariables}
            nodes={nodes}
          />
        </Form.Item>
        <Form.Item name="temperature" label="温度" initialValue={0.7}>
          <Slider min={0} max={1} step={0.1} />
        </Form.Item>
        <Form.Item name="maxTokens" label="最大 Token 数" initialValue={2048}>
          <InputNumber min={256} max={8192} step={256} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="maxIterations" label="最大迭代轮数" initialValue={10}>
          <InputNumber min={1} max={50} step={1} style={{ width: '100%' }} />
        </Form.Item>
        <Divider orientation="left" style={{ margin: '12px 0 12px' }}>🔧 工具与知识库</Divider>
        <Form.Item name="ragEnabled" label="启用 RAG" valuePropName="checked" initialValue={false}>
          <Switch />
        </Form.Item>
        <Form.Item name="knowledgeBaseIds" label="关联知识库">
          <Select mode="multiple" placeholder="选择知识库（多选）">
            {Array.isArray(knowledgeBases) && knowledgeBases.map(kb => (
              <Option key={kb.id} value={kb.id}>{kb.name}</Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="toolIds" label="可用工具">
          <Select mode="multiple" placeholder="选择工具（多选，留空则使用全部内置工具）">
            {Array.isArray(skills) && skills.map(s => (
              <Option key={s.id} value={s.id}>{s.name}</Option>
            ))}
          </Select>
        </Form.Item>
        <Divider orientation="left" style={{ margin: '12px 0 12px' }}>🧠 记忆</Divider>
        <Form.Item name="memoryEnabled" label="启用记忆" valuePropName="checked" initialValue={false}>
          <Switch />
        </Form.Item>
        <Form.Item name="memoryWindowSize" label="记忆窗口大小" initialValue={10}>
          <InputNumber min={1} max={100} step={1} style={{ width: '100%' }} />
        </Form.Item>

        {agentMode === 'supervisor' && (
          <>
            <Divider orientation="left" style={{ margin: '12px 0 12px' }}>👑 Supervisor 配置</Divider>
            <Form.Item className="variable-template-form-item" name="supervisorPrompt" label="Supervisor 提示词">
              <VariableTextArea
                rows={4}
                placeholder="定义 Supervisor 的协调策略，留空使用默认"
                availableVariables={availableVariables}
                nodes={nodes}
                variableLabel="插入 Supervisor 变量"
              />
            </Form.Item>
            <Form.Item name="supervisorProvider" label="Supervisor 模型服务" initialValue="qwen">
              <Select loading={modelCatalogLoading} options={providerOptions(supervisorProvider)} />
            </Form.Item>
            <Form.Item name="supervisorModel" label="Supervisor 模型" initialValue="qwen-plus">
              <ModelSelect models={modelsByProvider[supervisorProvider]} style={{ width: '100%' }} />
            </Form.Item>
            <Divider orientation="left" style={{ margin: '12px 0 12px' }}>🤖 Workers ({workers.length})</Divider>
            {workers.map((worker, index) => (
              <Card
                key={worker.id}
                size="small"
                title={
                  <Space>
                    <Tag color="blue">Worker {index + 1}</Tag>
                    <Input value={worker.name} onChange={(e) => updateWorker(index, 'name', e.target.value)} placeholder="Worker 名称" style={{ width: 120 }} size="small" />
                  </Space>
                }
                extra={<Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeWorker(index)} />}
                style={{ marginBottom: 8 }}
              >
                <Space direction="vertical" style={{ width: '100%' }} size={4}>
                  <Input value={worker.description} onChange={(e) => updateWorker(index, 'description', e.target.value)} placeholder="Worker 职责描述" size="small" />
                  <VariableTextArea
                    value={worker.systemPrompt}
                    onChange={(e) => updateWorker(index, 'systemPrompt', e.target.value)}
                    placeholder="Worker 系统提示词"
                    rows={2}
                    style={{ fontSize: 12 }}
                    availableVariables={availableVariables}
                    nodes={nodes}
                    variableLabel="插入 Worker 变量"
                  />
                  <Space>
                    <Select
                      value={worker.provider}
                      onChange={(value: UserModelProvider) => updateWorkerFields(index, {
                        provider: value,
                        model: modelsByProvider[value][0]?.id || '',
                      })}
                      options={providerOptions(worker.provider)}
                      size="small"
                      style={{ width: 120 }}
                    />
                    <ModelSelect models={modelsByProvider[worker.provider || 'qwen']} value={worker.model} onChange={(v) => updateWorker(index, 'model', v)} size="small" style={{ width: 180 }} />
                    <Text type="secondary" style={{ fontSize: 11 }}>温度:</Text>
                    <InputNumber value={worker.temperature} onChange={(v) => updateWorker(index, 'temperature', v)} min={0} max={1} step={0.1} size="small" style={{ width: 60 }} />
                  </Space>
                </Space>
              </Card>
            ))}
            <Button type="dashed" onClick={addWorker} icon={<PlusOutlined />} block style={{ marginTop: 4 }}>添加 Worker</Button>
          </>
        )}
      </>
    )
  }

  /** 按节点类型渲染对应的配置表单 */
  const renderConfigForm = () => {
      const commonFields = (
        <Form.Item name="label" label="节点名称">
          <Input placeholder="输入节点名称" />
        </Form.Item>
      )

      if (!selectedNode) return null

      switch (selectedNode.type) {
      case 'start':
        return <>{commonFields}<Text type="secondary">此节点为工作流的起点。</Text></>
      case 'userInput':
        return <>{commonFields}<Form.Item name="inputField" label="输入字段" rules={[{ required: true }]}><Input placeholder="例如: question" /></Form.Item></>
      case 'llm':
        return (
          <>
            {commonFields}
            <Form.Item name="provider" label="模型服务" initialValue="qwen">
              <Select loading={modelCatalogLoading} options={providerOptions(selectedProvider)} />
            </Form.Item>
            <Form.Item name="model" label="模型" initialValue="qwen-turbo">
              <ModelSelect models={modelsByProvider[selectedProvider]} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item className="variable-template-form-item" name="systemPrompt" label="系统提示词">
              <VariableTextArea
                rows={4}
                placeholder="定义模型的角色和行为"
                availableVariables={availableVariables}
                nodes={nodes}
                variableLabel="插入系统提示词变量"
              />
            </Form.Item>
            <Form.Item className="variable-template-form-item" name="userPrompt" label={<UserPromptLabel />} rules={[{ required: true }]}>
              <VariableTextArea
                rows={6}
                placeholder="输入发送给大模型的内容"
                availableVariables={availableVariables}
                nodes={nodes}
              />
            </Form.Item>
            <Form.Item name="temperature" label="温度" initialValue={0.7}><Slider min={0} max={1} step={0.1} /></Form.Item>
            <Form.Item name="maxTokens" label="最大 Token 数" initialValue={1024}><InputNumber min={1} max={8192} step={256} style={{ width: '100%' }} /></Form.Item>
          </>
        )
      case 'agent':
        return renderAgentConfig(commonFields)
      case 'rag':
        return (
          <>
            {commonFields}
            <Form.Item name="knowledgeBaseId" label="知识库" rules={[{ required: true }]}>
              <Select placeholder="选择一个知识库">{Array.isArray(knowledgeBases) && knowledgeBases.map(kb => (<Option key={kb.id} value={kb.id}>{kb.name}</Option>))}</Select>
            </Form.Item>
            <Form.Item className="variable-template-form-item" name="query" label="检索查询" rules={[{ required: true }]}>
              <VariableTextArea
                placeholder="输入检索内容"
                availableVariables={availableVariables}
                nodes={nodes}
              />
            </Form.Item>
            <Form.Item name="topK" label="Top K" initialValue={5}><Slider min={1} max={10} step={1} /></Form.Item>
          </>
        )
      case 'skill':
        return (
          <>
            {commonFields}
            <Form.Item name="skillId" label="选择工具" rules={[{ required: true }]}>
              <Select placeholder="选择一个内置或自定义工具">{Array.isArray(skills) && skills.map(s => (<Option key={s.id} value={s.id}>{s.name}</Option>))}</Select>
            </Form.Item>
            <Form.Item label="工具参数 (JSON)"><Form.Item name="parameters" noStyle><Input.TextArea rows={6} placeholder='{"param1": "value1"}' /></Form.Item></Form.Item>
          </>
        )
      case 'condition':
        return (
          <>
            {commonFields}
            <div className="condition-builder-summary">
              <span className="condition-builder-summary-icon" aria-hidden="true"><BranchesOutlined /></span>
              <div>
                <div className="condition-builder-summary-title">满足以下所有条件（AND）</div>
                <div className="condition-builder-summary-copy">全部满足时走“是”分支；任一不满足时走“否”分支。</div>
              </div>
            </div>
            <Form.List
              name="conditions"
              rules={[{
                validator: async (_, conditions) => {
                  if (!conditions?.length) throw new Error('请至少添加一个判断条件')
                },
              }]}
            >
              {(fields, { add, remove }, { errors }) => (
                <div className="condition-builder">
                  {fields.length === 0 ? (
                    <div className="condition-builder-empty">
                      <BranchesOutlined aria-hidden="true" />
                      <span>还没有判断条件</span>
                      <p>添加条件后，从已连接的上游节点中选择变量。</p>
                    </div>
                  ) : (
                    <div className="condition-rule-list" aria-live="polite">
                      {fields.map((field, index) => (
                        <div className="condition-rule-card" key={field.key}>
                          <div className="condition-rule-header">
                            <span className="condition-rule-index">条件 {index + 1}</span>
                            <Button
                              type="text"
                              danger
                              icon={<DeleteOutlined />}
                              className="condition-rule-remove"
                              aria-label={`删除条件 ${index + 1}`}
                              onClick={() => remove(field.name)}
                            />
                          </div>
                          <div className="condition-rule-fields">
                            <Form.Item
                              name={[field.name, 'variable']}
                              label="上游变量"
                              rules={[{ required: true, message: '请选择用于判断的上游变量' }]}
                            >
                              <Select
                                showSearch
                                optionFilterProp="label"
                                placeholder={availableVariables.length ? '选择节点输出' : '暂无可用的上游变量'}
                                options={conditionVariableGroups}
                                disabled={!availableVariables.length}
                                aria-label={`条件 ${index + 1} 的上游变量`}
                              />
                            </Form.Item>
                            <Form.Item
                              name={[field.name, 'operator']}
                              label="判断方式"
                              rules={[{ required: true, message: '请选择判断方式' }]}
                            >
                              <Select
                                placeholder="选择判断方式"
                                options={CONDITION_OPERATOR_OPTIONS}
                                aria-label={`条件 ${index + 1} 的判断方式`}
                              />
                            </Form.Item>
                            <Form.Item
                              name={[field.name, 'value']}
                              label="比较值"
                              rules={[{ required: true, message: '请输入要比较的值' }]}
                            >
                              <Input
                                placeholder="例如：已完成"
                                aria-label={`条件 ${index + 1} 的比较值`}
                              />
                            </Form.Item>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {!availableVariables.length && (
                    <div className="condition-builder-variable-hint">请先把条件节点连接到会产生结果的上游节点。</div>
                  )}
                  <Button
                    type="dashed"
                    block
                    icon={<PlusOutlined />}
                    className="condition-builder-add"
                    onClick={() => add({
                      variable: availableVariables[0]?.token,
                      operator: 'contains',
                      value: '',
                    })}
                  >
                    添加条件
                  </Button>
                  <Form.ErrorList errors={errors} />
                </div>
              )}
            </Form.List>
          </>
        )
      case 'output':
        return (
          <>
            {commonFields}
            <Form.Item className="variable-template-form-item" name="outputValue" label="输出内容" rules={[{ required: true }]}>
              <VariableTextArea
                rows={4}
                placeholder="输入最终返回内容"
                availableVariables={availableVariables}
                nodes={nodes}
                variableLabel="插入输出变量"
              />
            </Form.Item>
          </>
        )
      default:
        return <Empty description={`暂不支持 ${selectedNode.type} 节点的配置`} />
    }
  }

  return (
    <div className="config-panel">
      <div className="config-panel-header">
        <div className="config-panel-header-top">
          <span className="config-panel-header-kicker">Workflow editor</span>
          {selectedNodeMeta && (
            <span className="config-panel-header-badge">{selectedNodeMeta.label}</span>
          )}
        </div>
        <h3>{selectedNode ? selectedNodeName : '配置面板'}</h3>
        <p className="config-panel-header-description">
          {selectedNodeMeta?.description || '从画布中选择节点后，即可在这里编辑详细配置。'}
        </p>
      </div>
      <div className="config-panel-body">
        <Form
          key={selectedNode ? `${selectedNode.id}:${selectedNode.type}` : 'empty'}
          form={form}
          layout="vertical"
          preserve={false}
          onValuesChange={handleValuesChange}
          className="config-panel-form"
        >
          {selectedNode && availableProviders.length === 0 && !modelCatalogLoading && (
            <Alert
              type="warning"
              showIcon
              message="没有可用的模型服务"
              description="已保存的模型会保留显示，但执行前需要先配置并测试对应凭证。"
              action={<Button size="small" onClick={() => navigate('/model-settings')}>去配置</Button>}
              style={{ marginBottom: 16 }}
            />
          )}
          {!selectedNode ? (
            <div className="config-panel-empty">
              <div className="config-panel-empty-icon">
                <SettingOutlined />
              </div>
              <h4>选择一个节点开始编辑</h4>
              <p>点击画布中的任意节点，这里会显示对应参数、提示词和运行选项。</p>
              <div className="config-panel-empty-tip">修改会实时同步到当前工作流</div>
            </div>
          ) : renderConfigForm()}
        </Form>
      </div>
    </div>
  )
}

export default ConfigPanel
