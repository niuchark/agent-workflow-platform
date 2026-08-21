/**
 * Vite 构建配置：React 插件、路径别名与开发代理。
 *
 * 开发服务器把 /api 请求代理到后端（默认 localhost:3000），
 * 与后端全局前缀 /api 对应。
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // 常用路径别名：@ 及按目录区分的快捷引用
    alias: {
      '@': '/src',
      '@components': '/src/components',
      '@pages': '/src/pages',
      '@store': '/src/store',
      '@hooks': '/src/hooks',
      '@utils': '/src/utils',
      '@types': '/src/types',
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
