import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#0284c7',
          colorLink: '#0284c7',
          colorSuccess: '#059669',
          colorWarning: '#d97706',
          colorError: '#dc2626',
          borderRadius: 10,
          borderRadiusLG: 16,
          borderRadiusSM: 6,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans SC', sans-serif",
          fontSize: 14,
          colorBgContainer: '#ffffff',
          colorBgLayout: '#f8fafc',
          colorBorder: '#e2e8f0',
          colorBorderSecondary: '#f1f5f9',
          colorText: '#0f172a',
          colorTextSecondary: '#475569',
          colorTextTertiary: '#94a3b8',
          boxShadow:
            '0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)',
          boxShadowSecondary:
            '0 12px 30px -12px rgba(15,23,42,0.22)',
        },
        components: {
          Button: {
            borderRadius: 10,
            controlHeight: 38,
            primaryShadow: 'none',
          },
          Input: {
            borderRadius: 8,
          },
          Select: {
            borderRadius: 8,
          },
          Card: {
            borderRadius: 16,
          },
          Table: {
            borderRadius: 0,
            headerBg: '#f8fafc',
            headerColor: '#475569',
            rowHoverBg: '#f8fafc',
          },
          Menu: {
            itemBorderRadius: 12,
            itemSelectedBg: '#e0f2fe',
            itemSelectedColor: '#0369a1',
            itemHoverBg: '#f1f5f9',
            itemHoverColor: '#0f172a',
            itemActiveBg: '#bae6fd',
          },
          Modal: {
            borderRadius: 16,
          },
          Tag: {
            borderRadius: 999,
          },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>,
)
