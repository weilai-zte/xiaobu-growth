import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  // 开发时前端在 5174，数据服务在 8788，用代理把 /api 转过去，页面里统一写 /api
  server: {
    port: 5174,
    proxy: { '/api': { target: 'http://127.0.0.1:8788', changeOrigin: true } },
  },
  preview: {
    port: 4173,
    proxy: { '/api': { target: 'http://127.0.0.1:8788', changeOrigin: true } },
  },
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
})
