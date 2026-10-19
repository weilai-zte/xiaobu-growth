import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

/**
 * 界面测试跑在 jsdom 里，没有在线数据服务。
 * 这里只拦页面里写相对路径的 /api 请求（同步引擎用它），返回一份空的同步结果，
 * 让测试关注界面本身；连绝对地址的请求照旧走真 fetch（服务端测试要用）。
 */
const realFetch = globalThis.fetch
const emptySync = () => ({
  serverTime: new Date().toISOString(),
  seq: 0,
  resetSeq: 0,
  applied: { created: 0, updated: 0, stale: 0, same: 0 },
  tables: {},
  counts: {},
  removed: 0,
  ok: true,
})

vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
  const url =
    typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.startsWith('/api')) {
    return new Response(JSON.stringify(emptySync()), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  return realFetch(input as RequestInfo, init)
})
