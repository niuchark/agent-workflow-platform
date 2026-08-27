import { Avatar, Button, Modal, Tag, Typography } from 'antd'
import { SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons'
import { useStore } from '../../store'

interface ProfileModalProps {
  open: boolean
  onClose: () => void
}

/** 当前账户资料弹窗：只读展示稳定身份与账户信息。 */
const ProfileModal: React.FC<ProfileModalProps> = ({ open, onClose }) => {
  const { user } = useStore()

  const roleLabel = user?.globalRole === 'admin' ? '管理员' : '成员'
  const createdAt = user
    ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(user.createdAt))
    : '—'

  return (
    <Modal
      title="个人资料"
      open={open}
      onCancel={onClose}
      footer={<Button type="primary" onClick={onClose}>关闭</Button>}
      width={500}
      aria-label="个人资料"
    >
      <div className="profile-modal-body">
        <div className="profile-modal-summary">
          <Avatar size={52} src={user?.avatar} icon={<UserOutlined />} className="profile-modal-avatar" />
          <div className="profile-modal-copy">
            <strong>{user?.username || '用户'}</strong>
            <span>账户身份信息</span>
          </div>
          <Tag icon={<SafetyCertificateOutlined aria-hidden="true" />} color={user?.globalRole === 'admin' ? 'blue' : 'default'}>
            {roleLabel}
          </Tag>
        </div>

        <dl className="profile-detail-list">
          <div className="profile-detail-row">
            <dt>登录用户名</dt>
            <dd>
              <strong>{user?.username || '—'}</strong>
              <span className="profile-detail-note">用于登录，创建后不可修改</span>
            </dd>
          </div>
          <div className="profile-detail-row">
            <dt>用户 ID</dt>
            <dd className="profile-id-value">
              {user?.id ? (
                <Typography.Text
                  className="profile-id-text"
                  copyable={{ text: user.id, tooltips: ['复制用户 ID', '已复制'] }}
                >
                  {user.id}
                </Typography.Text>
              ) : '—'}
              <span className="profile-detail-note">系统生成的永久身份标识</span>
            </dd>
          </div>
          <div className="profile-detail-row">
            <dt>账户角色</dt>
            <dd>{roleLabel}</dd>
          </div>
          <div className="profile-detail-row">
            <dt>注册时间</dt>
            <dd>{createdAt}</dd>
          </div>
        </dl>
      </div>
    </Modal>
  )
}

export default ProfileModal
