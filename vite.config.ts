import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  // 开发时前端在 5174，数据服务在 8788，用代理把 /api 转过去，页面里统一写 /api
  server: {
    port: 5174,
    proxy: { '/api': { target: 'http://127.0.0.1:8788', changeOrigin: true } },
  },
  build: {rollupOptions: {input: {app:'index.html',modelPreview:'model-preview.html'}}},
  preview: {
    port: 4173,
    proxy: { '/api': { target: 'http://127.0.0.1:8788', changeOrigin: true } },
  },
  plugins: [react(), {
    name: 'local-preview-worker-refresh',
    apply: 'serve',
    transformIndexHtml() {
      // 旧版离线缓存会截留开发模块。仅开发预览移除本应用的静态缓存，保留 IndexedDB 和用户记录。
      return [{tag:'script',injectTo:'head-prepend',children:`(async()=>{
        if(!('serviceWorker' in navigator))return;
        const registrations=await navigator.serviceWorker.getRegistrations();
        const own=registrations.filter(r=>r.active&&new URL(r.active.scriptURL).pathname===new URL('sw.js',document.baseURI).pathname);
        if(!own.length)return;
        await Promise.all(own.map(r=>r.unregister()));
        const names=await caches.keys();
        await Promise.all(names.filter(n=>n.startsWith('xiaobu-growth-')).map(n=>caches.delete(n)));
        location.reload();
      })().catch(()=>{});`}]
    },
  }],
  test: {
    // 完整交互流程包含多次本地数据库刷新，繁忙机器上保留有限的等待余量。
    testTimeout: 15000,
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
})
