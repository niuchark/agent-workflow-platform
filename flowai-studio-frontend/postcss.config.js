/**
 * PostCSS 配置：接入 Tailwind CSS 与 autoprefixer。
 */
import { fileURLToPath } from 'node:url'

const tailwindConfig = fileURLToPath(new URL('./tailwind.config.js', import.meta.url))

export default {
  plugins: {
    tailwindcss: { config: tailwindConfig },
    autoprefixer: {},
  },
}
