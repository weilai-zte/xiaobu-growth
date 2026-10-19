import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PORT = 8798
const BASE = `http://127.0.0.1:${PORT}`

let server: ChildProcess | undefined

async function waitForServer() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const res = await fetch(`${BASE}/api/health`)
      if (res.ok) return
    } catch {
      /* 还没起来 */
    }
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  throw new Error('同步服务启动超时')
}

async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
  })
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : null }
}

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'xb-sync-'))
  server = spawn(process.execPath, ['server/index.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT), XB_DB: join(dir, 'test.db') },
    stdio: 'ignore',
  })
  await waitForServer()
})

afterAll(() => {
  server?.kill('SIGTERM')
})

describe('小步成长在线数据表', () => {
  it('健康检查返回十一张表与同步水位线', async () => {
    const { status, body } = await api('/api/health')
    expect(status).toBe(200)
    expect(body.ok).toBe(true)
    for (const entity of [
      'childProfiles',
      'dailyLogs',
      'taskRecords',
      'routineRules',
      'routineChecks',
      'conflictLogs',
      'strengthMoments',
      'weeklyReviews',
      'experiments',
      'taskTemplates',
    ]) {
      expect(body.counts[entity]).toBeDefined()
    }
    expect(typeof body.seq).toBe('number')
  })

  it('写入睡眠记录后能从增量接口拉到', async () => {
    const before = await api('/api/health')
    const created = await api('/api/dailyLogs', {
      method: 'POST',
      body: JSON.stringify({
        id: 'log-1',
        childId: 'child-1',
        date: '2026-10-16',
        sleepTime: '22:10',
        wakeTime: '06:40',
        nightCough: 'several',
      }),
    })
    expect(created.status).toBe(201)
    expect(created.body.row.sleepTime).toBe('22:10')

    const delta = await api(`/api/sync?since=${before.body.seq}`)
    expect(delta.body.tables.dailyLogs).toHaveLength(1)
    expect(delta.body.tables.dailyLogs[0].nightCough).toBe('several')
  })

  it('两台设备通过同一水位线双向同步', async () => {
    const push = await api('/api/sync', {
      method: 'POST',
      body: JSON.stringify({
        since: 0,
        changes: {
          taskRecords: [
            {
              id: 'task-device-a',
              childId: 'child-1',
              date: '2026-10-16',
              name: '听写第 3 课',
              subject: '语文',
              difficulty: 'medium',
              completion: 'partial',
              barriers: ['hard_to_start'],
              updatedAt: new Date(Date.now() + 5000).toISOString(),
            },
          ],
        },
      }),
    })
    expect(push.body.applied.created).toBe(1)

    const deviceB = await api('/api/sync?since=0')
    expect(
      deviceB.body.tables.taskRecords.some(
        (row: { id: string }) => row.id === 'task-device-a',
      ),
    ).toBe(true)

    const deviceA = await api(`/api/sync?since=${push.body.seq}`)
    expect(deviceA.body.tables.taskRecords).toHaveLength(0)
  })

  it('旧时间戳的写入被判为 stale，不覆盖新数据', async () => {
    const stale = await api('/api/sync', {
      method: 'POST',
      body: JSON.stringify({
        since: 0,
        changes: {
          taskRecords: [
            {
              id: 'task-device-a',
              childId: 'child-1',
              date: '2026-10-16',
              name: '被改坏的名字',
              updatedAt: '2020-01-01T00:00:00.000Z',
            },
          ],
        },
      }),
    })
    expect(stale.body.applied.stale).toBe(1)
    const rows = await api('/api/taskRecords')
    expect(rows.body.rows[0].name).toBe('听写第 3 课')
  })

  it('删除留下墓碑并同步出去', async () => {
    const before = await api('/api/health')
    const res = await api('/api/taskRecords/task-device-a', { method: 'DELETE' })
    expect(res.status).toBe(200)
    const list = await api('/api/taskRecords')
    expect(list.body.rows).toHaveLength(0)
    const delta = await api(`/api/sync?since=${before.body.seq}`)
    expect(delta.body.tables.taskRecords[0].deleted).toBe(true)
  })

  it('冲突复盘与优势事例也能同步', async () => {
    await api('/api/conflictLogs', {
      method: 'POST',
      body: JSON.stringify({
        id: 'conflict-1',
        childId: 'child-1',
        occurredAt: '2026-10-15T20:10:00.000Z',
        trigger: 'toy',
        childDescription: '他说是我先拿的',
        parentResponse: '先把两个人分开',
        resolution: '约定轮流玩',
        nextIdea: '下次先定顺序',
      }),
    })
    await api('/api/strengthMoments', {
      method: 'POST',
      body: JSON.stringify({
        id: 'strength-1',
        childId: 'child-1',
        date: '2026-10-14',
        category: 'care',
        event: '弟弟摔倒',
        childAction: '扶他起来',
        outcome: '弟弟不哭了',
      }),
    })
    const all = await api('/api/sync?since=0')
    expect(all.body.tables.conflictLogs).toHaveLength(1)
    expect(all.body.tables.strengthMoments).toHaveLength(1)
  })

  it('清空全部会推进重置水位线', async () => {
    const cleared = await api('/api/clear-all', { method: 'POST' })
    expect(cleared.status).toBe(200)
    const after = await api('/api/health')
    expect(after.body.counts.dailyLogs.rows).toBe(0)
    expect(after.body.resetSeq).toBeGreaterThan(0)
  })

  it('未知接口返回中文错误', async () => {
    const res = await api('/api/nope')
    expect(res.status).toBe(404)
    expect(res.body.error).toContain('未知接口')
  })

  it('服务端防止两台设备超额预留，也不会回退已兑现心愿', async () => {
    const post = (entity: string, row: object) => api(`/api/${entity}`, { method: 'POST', body: JSON.stringify(row) })
    await post('routineChecks', { id: 'reward-check', childId: 'reward-child', ruleId: 'reward-rule', date: '2026-10-18', status: 'done' })
    const wish = { childId: 'reward-child', name: '故事书', picture: 'book', cost: 5, status: 'requested' }
    expect((await post('wishes', { ...wish, id: 'wish-a' })).status).toBe(201)
    const second = await post('wishes', { ...wish, id: 'wish-b' })
    expect(second.status).not.toBe(201)
    expect(second.body.error).toContain('余额不足')
    await post('wishes', { ...wish, id: 'wish-a', status: 'redeemed', updatedAt: '2099-01-01T00:00:00.000Z' })
    const stale = await post('wishes', { ...wish, id: 'wish-a', status: 'approved', updatedAt: '2099-01-02T00:00:00.000Z' })
    expect(stale.body.row.status).toBe('redeemed')
  })

  it('页面由同一个服务托管', async () => {
    const page = await fetch(`${BASE}/`)
    expect(page.status).toBe(200)
    expect(await page.text()).toContain('<div id="root">')
  })
})
