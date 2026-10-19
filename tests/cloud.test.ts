import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { GrowthDB } from '../src/db/db'
import { createRepo, newId } from '../src/db/repo'
import { createSyncEngine, SYNC_KEYS } from '../src/db/sync'
import { todayKey } from '../src/lib/date'

// 显式开启才连接真实家庭库；CI 不读取本地连接码，也不写真实数据。
describe.skipIf(process.env.XB_CLOUD_VERIFY !== '1')('真实云端双设备同步', () => {
  it('离线记录保留，恢复后可跨设备读取、更新和删除', async () => {
    const file = await readFile('data/家庭连接码.txt', 'utf8')
    const key = file.match(/家庭连接码：([^\r\n]+)/)?.[1]
    if (!key) throw new Error('缺少本机家庭连接码')
    const endpoint = 'https://vhetgqujluiofywbjibt.supabase.co/functions/v1/xiaobu-sync'
    const devices = []
    let testId: string | undefined
    let offline = false
    for (let i = 0; i < 2; i++) {
      const database = new GrowthDB(`cloud-verify-${newId()}`)
      const repo = createRepo(database)
      await repo.setSetting(SYNC_KEYS.familyKey, key)
      const engine = createSyncEngine({ repo, endpoint, intervalMs: 600000, fetchImpl: (input, init) => {
        if (i === 0 && offline) return Promise.reject(new Error('模拟设备离线'))
        return fetch(input, { ...init, signal: AbortSignal.timeout(20000) })
      } })
      devices.push({ database, repo, engine })
    }
    const [a, b] = devices
    try {
      await a.engine.start(); await b.engine.start()
      const child = await a.repo.getPrimaryProfile()
      expect(child).toBeDefined()
      offline = true
      const moment = await a.repo.createStrength({ childId: child!.id, date: todayKey(), category: 'other', categoryOther: '连通性测试', event: '临时同步验证', childAction: '第一台设备写入', outcome: '验证完后删除' })
      testId = moment.id
      expect(await a.engine.syncNow()).toBe(false)
      expect(await a.repo.outboxCount()).toBeGreaterThan(0)
      offline = false
      expect(await a.engine.syncNow()).toBe(true)
      expect(await b.engine.syncNow()).toBe(true)
      expect((await b.repo.listStrengths(child!.id)).find(m => m.id === testId)?.childAction).toBe('第一台设备写入')
      await b.repo.updateStrength(testId, { childAction: '第二台设备更新' })
      expect(await b.engine.syncNow()).toBe(true)
      expect(await a.engine.syncNow()).toBe(true)
      expect((await a.repo.listStrengths(child!.id)).find(m => m.id === testId)?.childAction).toBe('第二台设备更新')
      await b.repo.deleteRecord('strengthMoments', testId)
      expect(await b.engine.syncNow()).toBe(true)
      expect(await a.engine.syncNow()).toBe(true)
      expect((await a.repo.listStrengths(child!.id)).some(m => m.id === testId)).toBe(false)
      testId = undefined
    } finally {
      offline = false
      if (testId) { await a.repo.deleteRecord('strengthMoments', testId); await a.engine.syncNow() }
      for (const device of devices) { device.engine.stop(); await device.database.delete() }
    }
  }, 90000)
})
