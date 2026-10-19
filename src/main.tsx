import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('找不到 root 节点')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// 离线能力：只在构建产物里注册 Service Worker，开发模式跳过缓存干扰
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch((err) => console.warn('Service Worker 注册失败', err))
  })
}
