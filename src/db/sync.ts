/**
 * 在线同步引擎。
 *
 * 数据存在服务端 SQLite 里，本地 IndexedDB 只是「镜像 + 离线队列」：
 *   1) 本地任何改动先写本地库，再进待同步队列（由 repo 的 writeHook 触发）；
 *   2) 同步时先拉远程增量合并进来，再把队列里的改动推上去；
 *   3) 推送失败的队列保留着，恢复网络后自动重试，不会丢数据。
 *
 * 服务端用全局递增的 sync_seq 做水位线，所以「同毫秒写入」不会漏拉；
 * 删除以墓碑形式同步，别的设备也能看到删除结果。
 */
import { ENTITY_NAMES, type EntityName } from './db'
import type { AdventureRoute, AdventureRun, BankAccount } from './types'
import { validAdventure } from '../lib/adventure'
import type { Repo, SyncRejection } from './repo'

export const SYNC_KEYS = {
  seq: 'sync.seq',
  resetSeq: 'sync.resetSeq',
  lastSyncAt: 'sync.lastSyncAt',
  lastError: 'sync.lastError',
  endpoint: 'sync.endpoint',
  familyKey: 'sync.familyKey',
}

/** 页面和接口同源时用相对路径即可；跨机部署可以在设置里改成完整地址 */
export const IS_GITHUB_PAGES = typeof location !== 'undefined' && location.hostname.endsWith('.github.io')
export const DEFAULT_ENDPOINT = import.meta.env.VITE_SYNC_ENDPOINT || (IS_GITHUB_PAGES ? '' : '/api')

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline'

export interface SyncSnapshot {
  status: SyncStatus
  endpoint: string
  /** 本地已拉到的服务端水位线 */
  localSeq: number
  /** 最近一次同步时服务端的水位线 */
  serverSeq: number
  /** 待推送条数 */
  pending: number
  lastSyncAt: string | null
  lastError: string | null
}

export interface SyncEngineOptions {
  repo: Repo
  endpoint?: string
  fetchImpl?: typeof fetch
  /** 轮询间隔，默认 20 秒 */
  intervalMs?: number
}

export interface SyncEngine {
  bankOperation: (input: {childId: string; action: 'settle' | 'configure' | 'deposit' | 'withdraw'; requestId: string; amount?:number; rateBps?:number; enabled?:boolean}) => Promise<BankAccount>
  claimAdventure: (childId: string, date: string, route: AdventureRoute) => Promise<AdventureRun>
  getSnapshot: () => SyncSnapshot
  subscribe: (listener: () => void) => () => void
  start: () => Promise<void>
  stop: () => void
  /** 立刻同步一次；返回是否成功 */
  syncNow: () => Promise<boolean>
  /** 保存新的接口地址，并立刻重试同步 */
  setEndpoint: (endpoint: string) => Promise<void>
  /** 服务端和本地一起清空 */
  clearEverything: () => Promise<void>
  /** 本地镜像整体重拉 */
  pullEverything: () => Promise<void>
}

interface SyncResponse {
  rejected?: SyncRejection[]
  account?: BankAccount
  adventure?: AdventureRun
  serverTime?: string
  seq?: number
  resetSeq?: number
  tables?: Record<string, Record<string, unknown>[]>
}

export function createSyncEngine(options: SyncEngineOptions): SyncEngine {
  const { repo } = options
  const doFetch = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args))
  const intervalMs = options.intervalMs ?? 20_000

  let endpoint = options.endpoint ?? DEFAULT_ENDPOINT
  let snapshot: SyncSnapshot = {
    status: 'idle',
    endpoint,
    localSeq: 0,
    serverSeq: 0,
    pending: 0,
    lastSyncAt: null,
    lastError: null,
  }
  const listeners = new Set<() => void>()
  let inFlight: Promise<boolean> | null = null
  let clearing = false
  let timer: ReturnType<typeof setInterval> | null = null
  let scheduled: ReturnType<typeof setTimeout> | null = null
  let started = false

  function emit(): void {
    for (const listener of listeners) listener()
  }

  function update(patch: Partial<SyncSnapshot>): void {
    snapshot = { ...snapshot, ...patch }
    emit()
  }

  async function refreshCounters(): Promise<void> {
    const [pending, localSeq, lastSyncAt] = await Promise.all([
      repo.outboxCount(),
      repo.getSetting<number>(SYNC_KEYS.seq, 0),
      repo.getSetting<string>(SYNC_KEYS.lastSyncAt, ''),
    ])
    update({
      pending,
      localSeq: Number(localSeq) || 0,
      lastSyncAt: lastSyncAt || null,
    })
  }

  async function request(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<SyncResponse> {
    if (!endpoint) throw new Error('云端连接尚未部署，请先完成家庭数据连接。')
    const familyKey = await repo.getSetting<string>(SYNC_KEYS.familyKey, '')
    const headers: Record<string, string> = {}
    if (body !== undefined) headers['content-type'] = 'application/json'
    if (familyKey) headers['x-family-key'] = familyKey
    const controller = ['/adventure','/bank'].includes(path) ? new AbortController() : undefined
    const timeout = controller ? setTimeout(() => controller.abort(), 20000) : undefined
    let res: Response
    try {
      res = await doFetch(`${endpoint}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: 'no-store',
        ...(controller ? { signal: controller.signal } : {}),
      })
    } catch (error) {
      if (controller?.signal.aborted) throw new Error('这次连接超时，请再试一次；已保存的奖励不会重抽。')
      throw error
    } finally { if (timeout) clearTimeout(timeout) }
    if (!res.ok) {
      let detail = ''
      try {
        const payload = (await res.json()) as { error?: string }
        detail = payload?.error ?? ''
      } catch {
        detail = ''
      }
      throw Object.assign(new Error(detail || `服务端返回 ${res.status}`), { definitive: true })
    }
    return (await res.json()) as SyncResponse
  }

  /** 把服务端返回的增量合并进本地镜像 */
  async function applyTables(
    tables: Record<string, Record<string, unknown>[]> | undefined,
  ): Promise<number> {
    if (!tables) return 0
    let applied = 0
    for (const entity of ENTITY_NAMES as EntityName[]) {
      const rows = tables[entity]
      if (!Array.isArray(rows) || rows.length === 0) continue
      applied += await repo.applyRemote(entity, rows)
    }
    return applied
  }

  async function resetAndPull(): Promise<void> {
    const fresh = await request('GET', '/sync?since=0')
    await clearMirror()
    await applyTables(fresh.tables)
    await repo.setSetting(SYNC_KEYS.seq, Number(fresh.seq ?? 0))
    await repo.setSetting(SYNC_KEYS.resetSeq, Number(fresh.resetSeq ?? 0))
  }

  async function clearMirror(): Promise<void> {
    const familyKey = await repo.getSetting<string>(SYNC_KEYS.familyKey, '')
    await repo.clearAll()
    await repo.setSetting(SYNC_KEYS.endpoint, endpoint)
    if (familyKey) await repo.setSetting(SYNC_KEYS.familyKey, familyKey)
  }

  async function run(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      update({ status: 'offline', lastError: '这台设备现在没有网络连接' })
      await refreshCounters()
      return false
    }

    update({ status: 'syncing', lastError: null })
    try {
      const since = Number(await repo.getSetting<number>(SYNC_KEYS.seq, 0)) || 0

      // 1) 先拉一次：既拿到远程增量，也顺便确认服务端有没有被整体清空过
      const head = await request('GET', `/sync?since=${since}`)
      const localReset = await repo.getSetting<number | null>(SYNC_KEYS.resetSeq, null)
      const remoteReset = Number(head.resetSeq ?? 0) || 0

      if (localReset === null) {
        // 第一次连接：把服务端当前的清空计数记成基线。
        // 这里绝不能当成「别处清空过」，否则升级上来的老用户第一次同步就会丢掉本地记录。
        await repo.setSetting(SYNC_KEYS.resetSeq, remoteReset)
      } else if (remoteReset > Number(localReset)) {
        // 计数严格变大，才是别处真的清空过：本地镜像跟着清，再从 0 重拉
        await clearMirror()
        await repo.setSetting(SYNC_KEYS.resetSeq, remoteReset)
        await repo.setSetting(SYNC_KEYS.seq, 0)
        const fresh = await request('GET', '/sync?since=0')
        await applyTables(fresh.tables)
        await repo.setSetting(SYNC_KEYS.seq, Number(fresh.seq ?? 0))
        await repo.setSetting(SYNC_KEYS.lastSyncAt, new Date().toISOString())
        await refreshCounters()
        update({ status: 'idle' })
        return true
      }

      await applyTables(head.tables)
      await repo.setSetting(SYNC_KEYS.seq, Number(head.seq ?? 0))

      // 2) 再把本地待推送的改动推上去
      const outbox = await repo.listOutbox()
      if (outbox.length > 0) {
        const changes: Record<string, Record<string, unknown>[]> = {}
        for (const item of outbox) {
          if (!changes[item.entity]) changes[item.entity] = []
          changes[item.entity].push(item.payload)
        }
        const pushed = await request('POST', '/sync', {
          // 用推送前的水位线而不是 head.seq：这样服务端会把这一轮里
          // 「因为本地还有待推送改动而被跳过」的那些记录一并带回来
          since,
          changes,
        })
        const rejected = pushed.rejected ?? []
        if (!Array.isArray(rejected) || rejected.some(r => !r || typeof r.entity !== 'string' || typeof r.id !== 'string' || typeof r.error !== 'string' || !['WISH_CONFLICT','INVALID_RECORD'].includes(r.code) || !(r.canonical === null || (typeof r.canonical === 'object' && !Array.isArray(r.canonical))))) throw new Error('同步响应格式不正确，待传记录已保留。')
        await repo.settleSyncBatch(outbox, rejected)
        // 已确认快照已出队；合并仍会保护新编辑和被拒绝的待传记录
        await applyTables(pushed.tables)
        await repo.setSetting(SYNC_KEYS.seq, Number(pushed.seq ?? 0))
        if (rejected.length) throw new Error(rejected.map(r => r.error).join('；'))
      }

      const stamp = new Date().toISOString()
      await repo.setSetting(SYNC_KEYS.lastSyncAt, stamp)
      await repo.setSetting(SYNC_KEYS.lastError, '')
      update({
        status: 'idle',
        lastError: null,
        lastSyncAt: stamp,
        serverSeq: Number(head.seq ?? 0),
      })
      await refreshCounters()
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : '同步失败'
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false
      await repo.setSetting(SYNC_KEYS.lastError, message)
      update({
        status: offline ? 'offline' : 'error',
        lastError: offline ? '这台设备现在没有网络连接' : message,
      })
      await refreshCounters()
      return false
    }
  }

  async function syncNow(): Promise<boolean> {
    if (clearing) return false
    if (inFlight) return inFlight
    inFlight = run().finally(() => {
      inFlight = null
    })
    return inFlight
  }

  /** 写入之后稍等片刻推一次，避免连续几次编辑发一堆请求 */
  function scheduleSoon(delay = 900): void {
    if (!started) return
    if (scheduled !== null) return
    scheduled = setTimeout(() => {
      scheduled = null
      void syncNow()
    }, delay)
  }

  function onOnline(): void {
    scheduleSoon(200)
  }

  function onFocus(): void {
    scheduleSoon(200)
  }

  function onVisibility(): void {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      scheduleSoon(200)
    }
  }

  return {
    async bankOperation(input) {
      if (!await syncNow()) throw new Error('银行需要连接家庭服务，请联网后重试；打卡仍可离线使用')
      const response = await request('POST', '/bank', { ...input, since: 0 })
      await applyTables(response.tables)
      if (!response.account) throw new Error('银行服务没有返回账户，请保留本次操作后重试')
      return response.account
    },
    async claimAdventure(childId, date, route) {
      if (!await syncNow()) throw new Error('先连上网络，把今天的小任务保存好，再来出发吧。')
      // 正在同步的一轮可能早于最新写入，再确认队列已排空。
      if (await repo.outboxCount() > 0 && !await syncNow()) throw new Error('小任务还没保存好，请稍后重试。')
      const response = await request('POST', '/adventure', { childId, date, route })
      const row = response.adventure
      if (!row || !validAdventure(row) || row.childId !== childId || row.date !== date) throw new Error('冒险结果没有收好，请再试一次；不会重复领奖。')
      await repo.applyRemote('adventureRuns', [row as unknown as Record<string, unknown>])
      return row
    },
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    async start() {
      if (started) return
      started = true
      endpoint = (await repo.getSetting<string>(SYNC_KEYS.endpoint, '')) || endpoint
      const [lastSyncAt, lastError] = await Promise.all([
        repo.getSetting<string>(SYNC_KEYS.lastSyncAt, ''),
        repo.getSetting<string>(SYNC_KEYS.lastError, ''),
      ])
      update({
        endpoint,
        lastSyncAt: lastSyncAt || null,
        lastError: lastError || null,
      })
      await refreshCounters()

      // 本地的每次写入都进队列，并在稍后自动推一次
      repo.setWriteHook(() => {
        scheduleSoon()
        // Some writes run inside an outer transaction without settings access.
        // Queue durability is owned by repo.write; counters may refresh later.
        void refreshCounters().catch(() => {})
      })

      if (typeof window !== 'undefined') {
        window.addEventListener('online', onOnline)
        window.addEventListener('focus', onFocus)
        document.addEventListener('visibilitychange', onVisibility)
      }

      timer = setInterval(() => {
        void syncNow()
      }, intervalMs)

      await syncNow()
    },

    stop() {
      started = false
      if (timer) clearInterval(timer)
      timer = null
      if (scheduled !== null) clearTimeout(scheduled)
      scheduled = null
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', onOnline)
        window.removeEventListener('focus', onFocus)
        document.removeEventListener('visibilitychange', onVisibility)
      }
    },

    syncNow,

    async setEndpoint(next) {
      const previous = endpoint
      endpoint = next.trim().replace(/\/+$/, '') || DEFAULT_ENDPOINT
      await repo.setSetting(SYNC_KEYS.endpoint, endpoint)
      // 不同服务的水位线不可复用；保留本机记录和待上传队列，从头读取新服务。
      if (previous !== endpoint) {
        await repo.setSetting(SYNC_KEYS.seq, 0)
        await repo.setSetting(SYNC_KEYS.resetSeq, null)
      }
      update({ endpoint })
      await syncNow()
    },

    async clearEverything() {
      if (clearing) throw new Error('正在清空数据，请稍候')
      clearing = true
      try {
        // Drain an older push before resetting, and block polling until mirrors agree.
        if (inFlight) await inFlight
        await request('POST', '/clear-all')
        const head = await request('GET', '/sync?since=0')
        await clearMirror()
        await repo.setSetting(SYNC_KEYS.seq, Number(head.seq ?? 0))
        await repo.setSetting(SYNC_KEYS.resetSeq, Number(head.resetSeq ?? 0))
        await repo.setSetting(SYNC_KEYS.lastSyncAt, new Date().toISOString())
        update({ status: 'idle', lastError: null })
        await refreshCounters()
      } finally { clearing = false }
    },

    async pullEverything() {
      update({ status: 'syncing', lastError: null })
      try {
        await resetAndPull()
        const stamp = new Date().toISOString()
        await repo.setSetting(SYNC_KEYS.lastSyncAt, stamp)
        update({ status: 'idle', lastError: null, lastSyncAt: stamp })
        await refreshCounters()
      } catch (error) {
        const message = error instanceof Error ? error.message : '重新拉取失败'
        update({ status: 'error', lastError: message })
      }
    },
  }
}
