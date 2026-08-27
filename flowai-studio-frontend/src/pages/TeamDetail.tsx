/**
 * 团队详情页面：管理团队信息、成员与团队内应用授权。
 *
 * 三个核心能力：
 * - 编辑团队信息、删除团队；
 * - 成员管理：添加成员、调整角色（所有者不可改/不可移除）、移除成员；
 * - 应用授权：把应用加入团队、调整访问权限、移除应用。
 */
import { useState, useEffect } from 'react'
import {
  Button, Modal, Form, Input, Select, Table, Tag, message,
  Popconfirm, Tabs, Avatar, Typography, Spin,
} from 'antd'
import {
  TeamOutlined, UserOutlined, DeleteOutlined, CrownOutlined,
  PlusOutlined, ArrowLeftOutlined, AppstoreOutlined, EditOutlined,
} from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import {
  TeamMember, TeamApplication, TeamRole,
  TEAM_ROLE_LABELS, TeamAppPermission, TEAM_APP_PERMISSION_LABELS,
  AddMemberForm, AddTeamAppForm,
} from '../types'

const { Title, Text } = Typography

/** 日期格式化：无效或空值显示占位符 */
const formatDate = (value?: string) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('zh-CN')
}

/** 优先展示后端业务错误，让添加成员失败时有明确的恢复方式 */
const getRequestErrorMessage = (error: unknown, fallback: string) => {
  const requestError = error as {
    message?: string
    response?: { data?: { message?: string } }
  }
  return requestError?.response?.data?.message || requestError?.message || fallback
}

/** 团队详情页面组件 */
const TeamDetail: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>()
  const navigate = useNavigate()
  const {
    currentTeam, teamMembers, teamApps, teamLoading,
    fetchTeam, updateTeam, deleteTeam,
    addTeamMember, updateMemberRole, removeTeamMember,
    addTeamApp, updateTeamAppPermission, removeTeamApp,
    apps, fetchApps,
  } = useStore()

  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false)
  const [isAddingMember, setIsAddingMember] = useState(false)
  const [isAddAppOpen, setIsAddAppOpen] = useState(false)
  const [isEditTeamOpen, setIsEditTeamOpen] = useState(false)
  const [memberForm] = Form.useForm()
  const [appForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const [activeTab, setActiveTab] = useState('members')

  // 进入页面加载团队详情与应用列表
  useEffect(() => {
    if (teamId) {
      fetchTeam(teamId)
      fetchApps()
    }
  }, [fetchApps, fetchTeam, teamId])

  /** 打开编辑弹窗：回填团队信息 */
  const handleEditTeam = () => {
    if (currentTeam) {
      editForm.setFieldsValue({
        name: currentTeam.name,
        description: currentTeam.description,
      })
      setIsEditTeamOpen(true)
    }
  }

  /** 提交团队信息修改 */
  const handleEditTeamSubmit = async (values: { name: string; description?: string }) => {
    try {
      await updateTeam(teamId!, values)
      message.success('团队信息已更新')
      setIsEditTeamOpen(false)
    } catch {
      message.error('更新失败')
    }
  }

  /** 删除团队：成功后返回团队列表 */
  const handleDeleteTeam = async () => {
    try {
      await deleteTeam(teamId!)
      message.success('团队已删除')
      navigate('/teams')
    } catch {
      message.error('删除失败')
    }
  }

  // ===== 成员操作 =====
  /** 添加团队成员 */
  const handleAddMember = async (values: AddMemberForm) => {
    setIsAddingMember(true)
    try {
      await addTeamMember(teamId!, { ...values, userId: values.userId.trim() })
      message.success('成员已添加')
      setIsAddMemberOpen(false)
      memberForm.resetFields()
    } catch (error) {
      message.error(getRequestErrorMessage(error, '添加失败，请重试'))
    } finally {
      setIsAddingMember(false)
    }
  }

  /** 修改成员角色 */
  const handleUpdateRole = async (memberId: string, role: TeamRole) => {
    try {
      await updateMemberRole(teamId!, memberId, { role })
      message.success('角色已更新')
    } catch {
      message.error('更新失败')
    }
  }

  /** 移除成员 */
  const handleRemoveMember = async (memberId: string) => {
    try {
      await removeTeamMember(teamId!, memberId)
      message.success('成员已移除')
    } catch {
      message.error('移除失败')
    }
  }

  // ===== 应用操作 =====
  /** 添加应用到团队 */
  const handleAddApp = async (values: AddTeamAppForm) => {
    try {
      await addTeamApp(teamId!, values)
      message.success('应用已添加到团队')
      setIsAddAppOpen(false)
      appForm.resetFields()
    } catch {
      message.error('添加失败')
    }
  }

  /** 调整团队应用的访问权限 */
  const handleUpdateAppPermission = async (teamAppId: string, permission: TeamAppPermission) => {
    try {
      await updateTeamAppPermission(teamId!, teamAppId, { permission })
      message.success('权限已更新')
    } catch {
      message.error('更新失败')
    }
  }

  /** 从团队移除应用 */
  const handleRemoveApp = async (teamAppId: string) => {
    try {
      await removeTeamApp(teamId!, teamAppId)
      message.success('应用已从团队移除')
    } catch {
      message.error('移除失败')
    }
  }

  /** 成员列表列定义：角色下拉切换、所有者特殊标记 */
  const memberColumns = [
    {
      title: '用户',
      dataIndex: 'userId',
      key: 'userId',
      render: (userId: string, record: TeamMember) => (
        <div className="member-user-cell">
          <Avatar size={32} icon={<UserOutlined />} style={{ backgroundColor: '#0284c7' }} />
          <span className="member-username">{record.user?.username || userId}</span>
        </div>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 180,
      render: (role: TeamRole, record: TeamMember) => (
        record.role === 'owner' ? (
          <Tag icon={<CrownOutlined />} color="gold">{TEAM_ROLE_LABELS[role]}</Tag>
        ) : (
          <Select
            value={role}
            size="small"
            style={{ width: 120 }}
            onChange={(value) => handleUpdateRole(record.id, value)}
            options={Object.entries(TEAM_ROLE_LABELS)
              .filter(([key]) => key !== 'owner')
              .map(([value, label]) => ({ value, label }))}
          />
        )
      ),
    },
    {
      title: '加入时间',
      dataIndex: 'joinedAt',
      key: 'joinedAt',
      width: 160,
      render: (date: string) => formatDate(date),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: unknown, record: TeamMember) =>
        record.role !== 'owner' ? (
          <Popconfirm
            title="确定要移除此成员吗？"
            onConfirm={() => handleRemoveMember(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              移除
            </Button>
          </Popconfirm>
        ) : null,
    },
  ]

  /** 应用列表列定义：权限下拉切换 */
  const appColumns = [
    {
      title: '应用',
      dataIndex: 'applicationId',
      key: 'applicationId',
      render: (applicationId: string, record: TeamApplication) => (
        <div className="team-app-cell">
          <AppstoreOutlined style={{ fontSize: 18, color: '#0284c7' }} />
          <span className="team-app-name">
            {record.application?.name || applicationId}
          </span>
        </div>
      ),
    },
    {
      title: '权限',
      dataIndex: 'permission',
      key: 'permission',
      width: 180,
      render: (permission: TeamAppPermission, record: TeamApplication) => (
        <Select
          value={permission}
          size="small"
          style={{ width: 140 }}
          onChange={(value) => handleUpdateAppPermission(record.id, value)}
          options={Object.entries(TEAM_APP_PERMISSION_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
      ),
    },
    {
      title: '添加时间',
      dataIndex: 'addedAt',
      key: 'addedAt',
      width: 160,
      render: (date: string) => formatDate(date),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: unknown, record: TeamApplication) => (
        <Popconfirm
          title="确定要从此团队移除该应用吗？"
          onConfirm={() => handleRemoveApp(record.id)}
          okText="确定"
          cancelText="取消"
        >
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>
            移除
          </Button>
        </Popconfirm>
      ),
    },
  ]

  // 可添加的应用：排除已在团队中的
  const availableApps = Array.isArray(apps)
    ? apps.filter((app) => !teamApps.some((ta) => ta.applicationId === app.id))
    : []

  if (teamLoading && !currentTeam) {
    return (
      <div className="team-loading">
        <Spin size="large" />
      </div>
    )
  }

  if (!currentTeam) {
    return (
      <div className="team-loading">
        <Text type="secondary">团队不存在或无权访问</Text>
        <Button type="link" onClick={() => navigate('/teams')}>返回团队列表</Button>
      </div>
    )
  }

  return (
    <div className="team-detail-page">
      {/* 团队头部 */}
      <div className="team-detail-header">
        <div className="team-detail-header-left">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/teams')}
            aria-label="返回团队列表"
          />
          <Avatar
            size={48}
            style={{ backgroundColor: '#0284c7' }}
            icon={<TeamOutlined />}
          >
            {currentTeam.name.charAt(0).toUpperCase()}
          </Avatar>
          <div className="team-detail-info">
            <Title level={4} style={{ margin: 0 }}>{currentTeam.name}</Title>
            <Text type="secondary">{currentTeam.description || '暂无描述'}</Text>
          </div>
        </div>
        <div className="team-detail-header-right">
          <Button icon={<EditOutlined />} onClick={handleEditTeam}>编辑</Button>
          <Popconfirm
            title="确定要删除此团队吗？此操作不可撤销"
            onConfirm={handleDeleteTeam}
            okText="确定"
            cancelText="取消"
          >
            <Button danger icon={<DeleteOutlined />}>删除团队</Button>
          </Popconfirm>
        </div>
      </div>

      {/* 标签页 */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'members',
            label: `成员 (${teamMembers.length})`,
            children: (
              <div className="team-tab-content">
                <div className="team-tab-toolbar">
                  <div className="team-tab-toolbar-copy">
                    <h3>团队成员</h3>
                    <Text type="secondary">管理成员及其在团队中的访问角色</Text>
                  </div>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setIsAddMemberOpen(true)}
                  >
                    添加成员
                  </Button>
                </div>
                <Table
                  dataSource={teamMembers}
                  columns={memberColumns}
                  rowKey="id"
                  pagination={false}
                  size="middle"
                  className="team-detail-table"
                  scroll={{ x: 680 }}
                />
              </div>
            ),
          },
          {
            key: 'apps',
            label: `应用 (${teamApps.length})`,
            children: (
              <div className="team-tab-content">
                <div className="team-tab-toolbar">
                  <div className="team-tab-toolbar-copy">
                    <h3>团队应用</h3>
                    <Text type="secondary">
                      {availableApps.length === 0 ? '所有应用已添加到团队' : '配置团队可访问的应用及权限'}
                    </Text>
                  </div>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setIsAddAppOpen(true)}
                    disabled={availableApps.length === 0}
                  >
                    添加应用
                  </Button>
                </div>
                <Table
                  dataSource={teamApps}
                  columns={appColumns}
                  rowKey="id"
                  pagination={false}
                  size="middle"
                  className="team-detail-table"
                  scroll={{ x: 680 }}
                />
              </div>
            ),
          },
        ]}
      />

      {/* 添加成员弹窗 */}
      <Modal
        title="添加成员"
        open={isAddMemberOpen}
        onCancel={() => { setIsAddMemberOpen(false); memberForm.resetFields() }}
        footer={null}
        width={480}
      >
        <Form form={memberForm} onFinish={handleAddMember} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="userId"
            label="用户名或用户 ID"
            extra="输入对方的登录用户名即可，也兼容用户 ID。"
            rules={[{ required: true, whitespace: true, message: '请输入用户名或用户 ID' }]}
          >
            <Input placeholder="例如：alice" autoComplete="off" />
          </Form.Item>
          <Form.Item
            name="role"
            label="角色"
            initialValue="viewer"
            rules={[{ required: true }]}
          >
            <Select
              options={Object.entries(TEAM_ROLE_LABELS)
                .filter(([key]) => key !== 'owner')
                .map(([value, label]) => ({ value, label }))}
            />
          </Form.Item>
          <div className="modal-footer">
            <Button disabled={isAddingMember} onClick={() => { setIsAddMemberOpen(false); memberForm.resetFields() }}>取消</Button>
            <Button type="primary" htmlType="submit" icon={<UserOutlined />} loading={isAddingMember}>
              添加
            </Button>
          </div>
        </Form>
      </Modal>

      {/* 添加应用弹窗 */}
      <Modal
        title="添加应用到团队"
        open={isAddAppOpen}
        onCancel={() => { setIsAddAppOpen(false); appForm.resetFields() }}
        footer={null}
        width={480}
      >
        <Form form={appForm} onFinish={handleAddApp} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="applicationId"
            label="选择应用"
            rules={[{ required: true, message: '请选择应用' }]}
          >
            <Select
              placeholder="选择要添加的应用"
              options={availableApps.map((app) => ({
                value: app.id,
                label: app.name,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="permission"
            label="权限"
            initialValue="can_view"
            rules={[{ required: true }]}
          >
            <Select
              options={Object.entries(TEAM_APP_PERMISSION_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </Form.Item>
          <div className="modal-footer">
            <Button onClick={() => { setIsAddAppOpen(false); appForm.resetFields() }}>取消</Button>
            <Button type="primary" htmlType="submit" icon={<AppstoreOutlined />}>
              添加
            </Button>
          </div>
        </Form>
      </Modal>

      {/* 编辑团队弹窗 */}
      <Modal
        title="编辑团队信息"
        open={isEditTeamOpen}
        onCancel={() => setIsEditTeamOpen(false)}
        footer={null}
        width={480}
      >
        <Form form={editForm} onFinish={handleEditTeamSubmit} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="团队名称"
            rules={[{ required: true, message: '请输入团队名称' }]}
          >
            <Input placeholder="给团队起个名字" />
          </Form.Item>
          <Form.Item name="description" label="团队描述">
            <Input.TextArea placeholder="简单描述团队的用途" rows={3} />
          </Form.Item>
          <div className="modal-footer">
            <Button onClick={() => setIsEditTeamOpen(false)}>取消</Button>
            <Button type="primary" htmlType="submit" loading={teamLoading}>
              保存
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

export default TeamDetail
