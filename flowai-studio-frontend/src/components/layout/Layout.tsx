import { useEffect, useMemo, useState } from 'react'
import { Layout as AntLayout, Menu, Button, Avatar, Dropdown, Typography, Grid } from 'antd'
import { useLocation, useNavigate, Outlet } from 'react-router-dom'
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  LogoutOutlined,
  AppstoreOutlined,
  BookOutlined,
  ToolOutlined,
  ApiOutlined,
  BugOutlined,
  ShopOutlined,
  ThunderboltOutlined,
  CaretDownOutlined,
  TeamOutlined,
  KeyOutlined,
  BarChartOutlined,
  SafetyOutlined,
  NodeIndexOutlined,
  CloudServerOutlined,
} from '@ant-design/icons'
import { useStore } from '../../store'
import BrandLogo from '../BrandLogo'

const { Header, Sider, Content } = AntLayout
const { Title } = Typography
const { useBreakpoint } = Grid

const routeMeta: Record<string, { title: string }> = {
  '/apps': { title: '工作台' },
  '/knowledge-bases': { title: '知识库' },
  '/tools': { title: '工具管理' },
  '/mcp': { title: 'MCP 服务器' },
  '/templates': { title: '模板市场' },
  '/debug': { title: '调试中心' },
  '/teams': { title: '团队管理' },
  '/api-keys': { title: 'API 密钥' },
  '/model-settings': { title: '模型服务' },
  '/cost-statistics': { title: '成本统计' },
  '/rate-limit': { title: '限流监控' },
  '/trace-list': { title: '全链路追踪' },
  '/trace-detail': { title: '追踪详情' },
}

const Layout: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const screens = useBreakpoint()
  const isMobile = screens.lg === false
  const { globalConfig, toggleSidebar, user, logout } = useStore()
  const [collapsed, setCollapsed] = useState(globalConfig.sidebarCollapsed)

  useEffect(() => {
    if (isMobile) setCollapsed(true)
  }, [isMobile])

  const handleToggle = () => {
    setCollapsed(!collapsed)
    toggleSidebar()
  }

  const menuItems = [
    { key: '/apps', icon: <AppstoreOutlined />, label: '工作台' },
    { key: '/knowledge-bases', icon: <BookOutlined />, label: '知识库' },
    { key: '/tools', icon: <ToolOutlined />, label: '工具管理' },
    { key: '/mcp', icon: <ApiOutlined />, label: 'MCP 服务器' },
    { key: '/templates', icon: <ShopOutlined />, label: '模板市场' },
    { key: '/debug', icon: <BugOutlined />, label: '调试中心' },
    { key: '/teams', icon: <TeamOutlined />, label: '团队管理' },
    { key: '/api-keys', icon: <KeyOutlined />, label: 'API 密钥' },
    { key: '/model-settings', icon: <CloudServerOutlined />, label: '模型服务' },
    { key: '/cost-statistics', icon: <BarChartOutlined />, label: '成本统计' },
    { key: '/rate-limit', icon: <SafetyOutlined />, label: '限流监控' },
    { key: '/trace-list', icon: <NodeIndexOutlined />, label: '全链路追踪' },
  ]

  const userMenu = [
    { key: 'profile', label: '个人资料', icon: <UserOutlined /> },
    { type: 'divider' as const },
    { key: 'logout', label: '退出登录', icon: <LogoutOutlined />, danger: true },
  ]

  const handleUserMenuClick = ({ key }: { key: string }) => {
    if (key === 'logout') { logout(); navigate('/login') }
  }

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key)
    if (isMobile) setCollapsed(true)
  }

  const selectedKey = '/' + (location.pathname.split('/')[1] || 'apps')
  const pageMeta = useMemo(() => routeMeta[selectedKey] || routeMeta['/apps'], [selectedKey])
  const isEditorRoute = /^\/apps\/[^/]+\/editor\/?$/.test(location.pathname)

  return (
    <AntLayout className="layout-container">
      <a href="#main-content" className="skip-link">跳转到主要内容</a>
      {isMobile && !collapsed && (
        <button type="button" className="sidebar-scrim" onClick={handleToggle} aria-label="关闭导航菜单" />
      )}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={220}
        collapsedWidth={isMobile ? 0 : 64}
        className="sidebar"
      >
        <div className="sidebar-shell">
          <div className="logo">
            <div className="logo-mark"><BrandLogo title="Agent Flow Platform" /></div>
            {!collapsed && (
              <div className="logo-copy">
                <h1 className="logo-text">Agent Flow Platform</h1>
                <span>Agent workflow builder</span>
              </div>
            )}
            {isMobile && !collapsed && (
              <Button
                type="text"
                icon={<MenuFoldOutlined />}
                className="sidebar-mobile-close"
                onClick={handleToggle}
                aria-label="关闭导航菜单"
              />
            )}
          </div>
          {!collapsed && <div className="sidebar-section-label">Navigation</div>}
          <Menu mode="inline" selectedKeys={[selectedKey]} items={menuItems} onClick={handleMenuClick} className="menu" />
          {!collapsed && (
            <div className="sidebar-footer-card">
              <div className="sidebar-footer-icon"><ThunderboltOutlined /></div>
              <div>
                <strong>Agent Flow Platform</strong>
                <p>用 AI 工作流自动化你的业务流程。</p>
              </div>
            </div>
          )}
        </div>
      </Sider>
      <AntLayout className="layout-main">
        <Header className="header">
          <div className="header-left">
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={handleToggle}
              className="trigger"
              aria-label={collapsed ? '展开导航菜单' : '收起导航菜单'}
              aria-expanded={!collapsed}
            />
            <div className="header-copy"><Title level={3}>{pageMeta.title}</Title></div>
          </div>
          <div className="header-right">
            <div className="header-online-dot"><span className="online-dot" /><span className="online-text">在线</span></div>
            <Dropdown menu={{ items: userMenu, onClick: handleUserMenuClick }} trigger={['click']} placement="bottomRight">
              <button type="button" className="profile-chip" aria-label="打开用户菜单">
                <Avatar size={26} icon={<UserOutlined />} className="!shrink-0 !bg-brand-100 !text-brand-700" />
                <div className="profile-copy"><span className="username">{user?.username || '用户'}</span></div>
                <CaretDownOutlined className="profile-caret" />
              </button>
            </Dropdown>
          </div>
        </Header>
        <Content id="main-content" className={`content${isEditorRoute ? ' content--editor' : ''}`} tabIndex={-1}>
          <div className={`content-container${isEditorRoute ? ' content-container--editor' : ''}`}><Outlet /></div>
        </Content>
      </AntLayout>
    </AntLayout>
  )
}

export default Layout
