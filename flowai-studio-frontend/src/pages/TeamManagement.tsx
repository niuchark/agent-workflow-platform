import { useState, useEffect, useRef } from 'react'
import {
  Button, Modal, Form, Input, Select, Table, Card, Tag, Space, message,
  Popconfirm, Empty, Spin, Avatar, Tooltip, Typography, Dropdown,
} from 'antd'
import {
  PlusOutlined, TeamOutlined, UserOutlined, DeleteOutlined,
  EditOutlined, ExportOutlined, CrownOutlined, MoreOutlined,
  SearchOutlined, AppstoreOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { Team, TeamMember, CreateTeamForm, TEAM_ROLE_LABELS, TeamRole, TEAM_APP_PERMISSION_LABELS, TeamAppPermission } from '../types'
import './TeamManagement.css'

const { Title, Text } = Typography

const TeamManagement: React.FC = () => {
  const navigate = useNavigate()
  const {
    teams, isLoading, fetchMyTeams, createTeam, deleteTeam, leaveTeam,
  } = useStore()

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const initDone = useRef(false)

  useEffect(() => {
    if (initDone.current) return
    initDone.current = true
    fetchMyTeams()
  }, [])

  const handleCreate = () => {
    form.resetFields()
    setIsCreateModalOpen(true)
  }

  const handleCreateSubmit = async (values: CreateTeamForm) => {
    try {
      const team = await createTeam(values)
      message.success('团队创建成功')
      setIsCreateModalOpen(false)
      navigate(`/teams/${team.id}`)
    } catch {
      message.error('创建失败，请重试')
    }
  }

  const handleDelete = async (teamId: string) => {
    try {
      await deleteTeam(teamId)
      message.success('团队已删除')
    } catch {
      message.error('删除失败')
    }
  }

  const handleLeave = async (teamId: string) => {
    try {
      await leaveTeam(teamId)
      message.success('已离开团队')
    } catch {
      message.error('操作失败')
    }
  }

  const filteredTeams = Array.isArray(teams)
    ? teams.filter(
        (t) =>
          t.name.toLowerCase().includes(searchText.toLowerCase()) ||
          (t.description && t.description.toLowerCase().includes(searchText.toLowerCase())),
      )
    : []

  const columns = [
    {
      title: '团队名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Team) => (
        <div className="team-name-cell" onClick={() => navigate(`/teams/${record.id}`)}>
          <Avatar
            size={36}
            style={{ backgroundColor: '#7c3aed', flexShrink: 0 }}
            icon={<TeamOutlined />}
          >
            {name.charAt(0).toUpperCase()}
          </Avatar>
          <div className="team-name-info">
            <span className="team-name-text">{name}</span>
            {record.description && (
              <span className="team-name-desc">{record.description}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      title: '成员',
      dataIndex: 'members',
      key: 'members',
      width: 100,
      render: (members: TeamMember[]) => (
        <Tag icon={<UserOutlined />}>{members?.length || 0}</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (date: string) => new Date(date).toLocaleDateString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: unknown, record: Team) => (
        <Space>
          <Button
            type="link"
            size="small"
            onClick={() => navigate(`/teams/${record.id}`)}
          >
            管理
          </Button>
          <Popconfirm
            title="确定要离开此团队吗？"
            onConfirm={() => handleLeave(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<ExportOutlined />}>
              离开
            </Button>
          </Popconfirm>
          <Popconfirm
            title="确定要删除此团队吗？此操作不可撤销"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="team-management-page">
      <div className="team-toolbar">
        <div className="team-toolbar-left">
          <h2 className="team-page-title">团队管理</h2>
          <span className="team-count-badge">{filteredTeams.length}</span>
        </div>
        <div className="team-toolbar-right">
          <Input
            placeholder="搜索团队…"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            prefix={<SearchOutlined style={{ color: 'var(--c-text-tertiary)' }} />}
            allowClear
            className="team-search"
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            创建团队
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="team-loading">
          <Spin size="large" />
        </div>
      ) : filteredTeams.length > 0 ? (
        <Table
          dataSource={filteredTeams}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 个团队` }}
          className="team-table"
        />
      ) : (
        <div className="team-empty-wrapper">
          <Empty description="暂无团队，点击「创建团队」开始协作" />
        </div>
      )}

      <Modal
        title="创建团队"
        open={isCreateModalOpen}
        onCancel={() => setIsCreateModalOpen(false)}
        footer={null}
        width={480}
      >
        <Form form={form} onFinish={handleCreateSubmit} layout="vertical" style={{ marginTop: 16 }}>
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
            <Button onClick={() => setIsCreateModalOpen(false)}>取消</Button>
            <Button type="primary" htmlType="submit" loading={isLoading} icon={<TeamOutlined />}>
              创建团队
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

export default TeamManagement
