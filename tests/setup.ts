import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'
import {configure} from '@testing-library/react'

// 页面含本地数据库异步刷新，给繁忙机器留出等待窗口，断言内容保持不变。
configure({asyncUtilTimeout:5000})

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

// jsdom 没有媒体解码器；声音行为由专用测试与真实浏览器分别验证。
if(typeof HTMLMediaElement!=='undefined'){
  vi.spyOn(HTMLMediaElement.prototype,'play').mockResolvedValue(undefined)
  vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{})
}
