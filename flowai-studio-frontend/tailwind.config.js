/**
 * Tailwind CSS 配置：设计令牌（颜色/字体/阴影）与内容扫描范围。
 *
 * preflight 关闭以兼容 Ant Design；品牌色/语义色与全局样式层
 * （src/index.css 中的 CSS 变量）保持一致。
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: {
    relative: true,
    files: [
      './index.html',
      './src/**/*.{js,ts,jsx,tsx}',
    ],
  },
  theme: {
    extend: {
      // 品牌与语义色板（与 index.css 的 CSS 变量同源）
      colors: {
        brand: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        canvas: '#f8fafc',
        surface: '#ffffff',
        ink: '#0f172a',
        muted: '#64748b',
        subtle: '#94a3b8',
        line: '#e2e8f0',
        positive: '#059669',
        warning: '#d97706',
        danger: '#dc2626',
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        display: ["Space Grotesk", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "SFMono-Regular", "Consolas", "Liberation Mono", "monospace"],
      },
      boxShadow: {
        panel: '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)',
        lift: '0 8px 24px -16px rgba(15, 23, 42, 0.2)',
        focus: '0 0 0 3px rgba(14, 165, 233, 0.18)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
}
