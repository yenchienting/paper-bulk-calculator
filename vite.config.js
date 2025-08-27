// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // 你的 repo 叫 paper-bulk-calculator，所以 base 要設成這個路徑
  base: '/paper-bulk-calculator/',
})

