import { useState, useEffect } from 'react'
import {
  Button, Modal, Form, Input, Select, Table, Card, Tag, Space, message,
  Popconfirm, Tabs, Avatar, Tooltip, Typography, Spin,
} from 'antd'
import {
  TeamOutlined, UserOutlined, DeleteOutlined, CrownOutlined,
  PlusOutlined, ArrowLeftOutlined, AppstoreOutlined, EditOutlined,
} from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import {
  Team, TeamMember, TeamApplication, TeamRole,
  TEAM_ROLE_LABELS, TeamAppPermission, TEAM_APP_PERMISSION_LABELS,
  AddMemberForm, AddTeamAppForm,
} from '../types'
import './TeamManagement.css'

const { Title, Text } = Typography

const TeamDetail: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>()
  const navigate = useNavigate()
  const {
    currentTeam, teamMembers, teamApps, isLoading,
    fetchTeam, updateTeam, deleteTeam,
    addTeamMember, updateMemberRole, removeTeamMember,
    addTeamApp, updateTeamAppPermission, removeTeamApp,
    apps, fetchApps,
  } = useStore()

  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false)
  const [isAddAppOpen, setIsAddAppOpen] = useState(false)
  const [isEditTeamOpen, setIsEditTeamOpen] = useState(false)
  const [memberForm] = Form.useForm()
  const [appForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const [activeTab, setActiveTab] = useState('members')

  useEffect(() => {
    if (teamId) {
      fetchTeam(teamId)
      fetchApps()
    }
  }, [teamId])

  const handleEditTeam = () => {
    if (currentTeam) {
      editForm.setFieldsValue({
        name: currentTeam.name,
        description: currentTeam.description,
      })
      setIsEditTeamOpen(true)
    }
  }

  const handleEditTeamSubmit = async (values: { name: string; description?: string }) => {
    try {
      await updateTeam(teamId!, values)
      message.success('团队信息已更新')
      setIsEditTeamOpen(false)
    } catch {
      message.error('更新失败')
    }
  }

  const handleDeleteTeam = async () => {
    try {
      await deleteTeam(teamId!)
      message.success('团队已删除')
      navigate('/teams')
    } catch {
      message.error('删除失败')
    }
  }

  // 成员操作
  const handleAddMember = async (values: AddMemberForm) => {
    try {
      await addTeamMember(teamId!, values)
      message.success('成员已添加')
      setIsAddMemberOpen(false)
      memberForm.resetFields()
    } catch {
      message.error('添加失败')
    }
  }

  const handleUpdateRole = async (memberId: string, role: TeamRole) => {
    try {
      await updateMemberRole(teamId!, memberId, { role })
      message.success('角色已更新')
    } catch {
      message.error('更新失败')
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    try {
      await removeTeamMember(teamId!, memberId)
      message.success('成员已移除')
    } catch {
      message.error('移除失败')
    }
  }

  // 应用操作
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

  const handleUpdateAppPermission = async (teamAppId: string, permission: TeamAppPermission) => {
    try {
      await updateTeamAppPermission(teamId!, teamAppId, { permission })
      message.success('权限已更新')
    } catch {
      message.error('更新失败')
    }
  }

  const handleRemoveApp = async (teamAppId: string) => {
    try {
      await removeTeamApp(teamId!, teamAppId)
      message.success('应用已从团队移除')
    } catch {
      message.error('移除失败')
    }
  }

  // 成员列表列
  const memberColumns = [
    {
      title: '用户',
      dataIndex: 'userId',
      key: 'userId',
      render: (userId: string, record: TeamMember) => (
        <div className="member-user-cell">
          <Avatar size={32} icon={<UserOutlined />} style={{ backgroundColor: '#7c3aed' }} />
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
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (date: string) => new Date(date).toLocaleDateString('zh-CN'),
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

  // 应用列表列
  const appColumns = [
    {
      title: '应用',
      dataIndex: 'applicationId',
      key: 'applicationId',
      render: (applicationId: string, record: TeamApplication) => (
        <div className="team-app-cell">
          <AppstoreOutlined style={{ fontSize: 18, color: '#7c3aed' }} />
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
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (date: string) => new Date(date).toLocaleDateString('zh-CN'),
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

  // 可添加的应用（排除已在团队中的）
  const availableApps = Array.isArray(apps)
    ? apps.filter((app) => !teamApps.some((ta) => ta.applicationId === app.id))
    : []

  if (isLoading && !currentTeam) {
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
          />
          <Avatar
            size={48}
            style={{ backgroundColor: '#7c3aed' }}
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
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setIsAddAppOpen(true)}
                    disabled={availableApps.length === 0}
                  >
                    添加应用
                  </Button>
                  {availableApps.length === 0 && (
                    <Text type="secondary" style={{ marginLeft: 8 }}>
                      所有应用已添加到团队
                    </Text>
                  )}
                </div>
                <Table
                  dataSource={teamApps}
                  columns={appColumns}
                  rowKey="id"
                  pagination={false}
                  size="middle"
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
            label="用户 ID"
            rules={[{ required: true, message: '请输入用户 ID' }]}
          >
            <Input placeholder="输入要添加的用户 ID" />
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
            <Button onClick={() => { setIsAddMemberOpen(false); memberForm.resetFields() }}>取消</Button>
            <Button type="primary" htmlType="submit" icon={<UserOutlined />}>
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
            <Button type="primary" htmlType="submit" loading={isLoading}>
              保存
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

export default TeamDetail
