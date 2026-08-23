/**
 * 主布局组件：受保护页面共用的侧边栏 + 顶栏 + 内容区框架。
 *
 * - 侧边栏提供全站导航，移动端自动折叠并显示遮罩；
 * - 顶栏展示当前页面标题、折叠按钮与用户菜单（退出登录）；
 * - 内容区通过 Outlet 渲染当前路由页面，编辑器路由使用全宽布局。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
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

/** 路由路径 → 顶栏标题 的映射 */
const routeMeta: Record<string, { title: string }> = {
  '/apps': { title: '工作台' },
  '/knowledge-bases': { title: '知识库' },
  '/tools': { title: '工具管理' },
  '/mcp': { title: 'MCP 服务器' },
  '/templates': { title: '模板市场' },
  '/debug': { title: '调试中心' },
  '/teams': { title: '团队管理' },
  '/api-keys': { title: 'API 密钥' },
  '/model-settings': { title: '模型配置' },
  '/cost-statistics': { title: '成本统计' },
  '/rate-limit': { title: '限流监控' },
  '/trace-list': { title: '全链路追踪' },
  '/trace-detail': { title: '追踪详情' },
}

/** 主布局组件：导航、顶栏与内容区 */
const Layout: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const screens = useBreakpoint()
  const isMobile = screens.lg === false
  const { globalConfig, toggleSidebar, user, logout } = useStore()
  const [collapsed, setCollapsed] = useState(globalConfig.sidebarCollapsed)
  const mobileMenuTriggerRef = useRef<HTMLElement | null>(null)

  // 移动端始终折叠侧边栏
  useEffect(() => {
    if (isMobile) setCollapsed(true)
  }, [isMobile])

  /** 切换侧边栏；移动端关闭后把焦点还给打开导航的按钮。 */
  const handleToggle = (event?: React.MouseEvent<HTMLElement>) => {
    const nextCollapsed = !collapsed

    if (isMobile && !nextCollapsed) {
      mobileMenuTriggerRef.current = event?.currentTarget ?? document.activeElement as HTMLElement
    }

    setCollapsed(nextCollapsed)
    if (!isMobile) toggleSidebar()

    if (isMobile && nextCollapsed) {
      requestAnimationFrame(() => mobileMenuTriggerRef.current?.focus())
    }
  }

  // 路由切换后把辅助技术焦点移到主内容，避免仍停留在旧导航项。
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      document.getElementById('main-content')?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [location.pathname])

  // 移动导航打开时聚焦关闭按钮，并允许 Escape 关闭和恢复触发点。
  useEffect(() => {
    if (!isMobile || collapsed) return

    const focusFrame = requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('.sidebar-mobile-close')?.focus()
    })
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setCollapsed(true)
      requestAnimationFrame(() => mobileMenuTriggerRef.current?.focus())
    }

    document.addEventListener('keydown', handleEscape)
    return () => {
      cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [collapsed, isMobile])

  /** 侧边栏导航项 */
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
    ...(user?.globalRole === 'admin'
      ? [{ key: '/rate-limit', icon: <SafetyOutlined />, label: '限流监控' }]
      : []),
    { key: '/trace-list', icon: <NodeIndexOutlined />, label: '全链路追踪' },
  ]

  /** 用户下拉菜单项 */
  const userMenu = [
    { key: 'profile', label: '个人资料', icon: <UserOutlined /> },
    { type: 'divider' as const },
    { key: 'logout', label: '退出登录', icon: <LogoutOutlined />, danger: true },
  ]

  /** 用户菜单点击：退出登录并跳转登录页 */
  const handleUserMenuClick = ({ key }: { key: string }) => {
    if (key === 'logout') { logout(); navigate('/login') }
  }

  /** 导航菜单点击：跳转路由，移动端跳转后收起侧边栏 */
  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key)
    if (isMobile) setCollapsed(true)
  }

  // 当前选中的菜单项：取路径第一段作为 key
  const selectedKey = '/' + (location.pathname.split('/')[1] || 'apps')
  // 当前页面标题元信息
  const pageMeta = useMemo(() => routeMeta[selectedKey] || routeMeta['/apps'], [selectedKey])
  // 编辑器路由使用全宽内容区
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
              <div className="sidebar-footer-copy">
                <strong title="Agent Flow Platform">Agent Flow Platform</strong>
                <p title="用 AI 工作流自动化你的业务流程。">用 AI 工作流自动化你的业务流程。</p>
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
