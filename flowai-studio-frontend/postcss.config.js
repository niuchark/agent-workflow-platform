import { fileURLToPath } from 'node:url'

const tailwindConfig = fileURLToPath(new URL('./tailwind.config.js', import.meta.url))

export default {
  plugins: {
    tailwindcss: { config: tailwindConfig },
    autoprefixer: {},
  },
}
