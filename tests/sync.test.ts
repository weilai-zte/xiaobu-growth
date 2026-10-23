import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { GrowthDB } from '../src/db/db'
import { createRepo } from '../src/db/repo'
import { createSyncEngine, type SyncEngine } from '../src/db/sync'
import { createFamilyRepo } from '../src/lib/family'
import { birdLoot, birdInventory } from '../src/lib/birdCompanion'

const PORT = 8799
const BASE = `http://127.0.0.1:${PORT}`
const ENDPOINT = `${BASE}/api`

let server: ChildProcess | undefined

interface Device {
  database: GrowthDB
  repo: ReturnType<typeof createRepo>
  engine: SyncEngine
}

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

/** 每次都用一个新的库名，相当于一台全新的设备 */
async function openDevice(endpoint = ENDPOINT): Promise<Device> {
  const database = new GrowthDB(`sync-${Math.random().toString(16).slice(2)}`)
  const deviceRepo = createRepo(database)
  const engine = createSyncEngine({ repo: deviceRepo, endpoint, intervalMs: 600_000 })
  await engine.start()
  return { database, repo: deviceRepo, engine }
}

async function closeDevice(device: Device) {
  device.engine.stop()
  await device.database.delete()
}

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'xb-sync-e2e-'))
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

beforeEach(async () => {
  await fetch(`${BASE}/api/clear-all`, { method: 'POST' })
})

describe('双向同步', () => {
  it('英语计划和即时错词跨设备往返，未完成不加星且不需要新表', async () => {
    const a = await openDevice(), b = await openDevice()
    try {
      const child = await a.repo.createProfile({ name: '英语同步测试' })
      await a.repo.ensureHabitPlan(child.id)
      const rule = (await a.repo.listRules(child.id)).find(r => r.habitKey === 'picture_words')!
      const plan = await a.repo.ensureStudyPlan(child.id, rule.id, '2026-10-20')
      await a.repo.recordStudyAttempt(child.id, rule.id, '2026-10-20', { id: 'first-attempt', word: plan[0], selectedWord: plan[1], revealed: false, answeredAt: '2026-10-20T01:00:00.000Z' })
      expect(await a.engine.syncNow()).toBe(true)
      expect(await b.engine.syncNow()).toBe(true)
      const checks = await b.repo.listChecks(child.id)
      expect(checks[0].studyPlan).toEqual(plan)
      expect(checks[0].studyAttempts?.[0].word).toBe(plan[0])
      expect(checks[0].status).toBe('partial')
      expect(await b.repo.ensureStudyPlan(child.id, rule.id, '2026-10-20')).toEqual(plan)
      await b.repo.setCheck(child.id, rule.id, '2026-10-20', 'done', null, { studyWords: plan.slice(0,4), studyLevel: 'easy' })
      expect(await b.engine.syncNow()).toBe(true)
      expect(await a.engine.syncNow()).toBe(true)
      const restored = (await a.repo.listChecks(child.id))[0]
      expect(restored.status).toBe('done')
      expect(restored.studyAttempts?.[0].word).toBe(plan[0])
      expect(restored.rewardStars).toBe(2)
    } finally { await closeDevice(a); await closeDevice(b) }
  })
  it('家庭公约跨设备签订、离线打卡重传和鼓励记录保持唯一', async () => {
    const a = await openDevice()
    const b = await openDevice()
    try {
      const child = await a.repo.createProfile({name:'家庭测试'})
      const fa = createFamilyRepo(a.database), fb = createFamilyRepo(b.database)
      const [parent, kid] = await fa.ensureMembers(child.id)
      const pact = await fa.createPact(child.id,parent.id,'一起成长',[{memberId:parent.id,text:'专心陪伴'},{memberId:kid.id,text:'收好玩具'}])
      await fa.sealPact(pact.id,parent.id)
      await fa.signPact(pact.id,parent.id)
      expect(await a.engine.syncNow()).toBe(true)
      expect(await b.engine.syncNow()).toBe(true)
      await fb.signPact(pact.id,kid.id)
      expect(await b.engine.syncNow()).toBe(true)
      expect(await a.engine.syncNow()).toBe(true)
      expect(await fa.listSignatures(child.id)).toHaveLength(2)
      await fb.checkIn(pact.id,1,kid.id,'2026-10-20')
      await fb.checkIn(pact.id,1,kid.id,'2026-10-20')
      expect(await b.engine.syncNow()).toBe(true)
      expect(await a.engine.syncNow()).toBe(true)
      const [check] = await fa.listChecks(child.id)
      await fa.encourage(check.id,parent.id)
      expect(await a.engine.syncNow()).toBe(true)
      expect(await b.engine.syncNow()).toBe(true)
      expect(await fb.listChecks(child.id)).toHaveLength(1)
      expect(await fb.listReactions(child.id)).toHaveLength(1)
      expect(await a.repo.outboxCount()).toBe(0)
      expect(await b.repo.outboxCount()).toBe(0)
    } finally { await closeDevice(a); await closeDevice(b) }
  })
  it('新心愿和关联公约同批同步，另一台分别签订，原打卡只计一次星', async () => {
    const a = await openDevice(), b = await openDevice()
    try {
      const child = await a.repo.createProfile({name:'心愿同步测试'})
      await a.repo.ensureHabitPlan(child.id)
      const fa = createFamilyRepo(a.database), fb = createFamilyRepo(b.database)
      const [parent,kid] = await fa.ensureMembers(child.id)
      const [rule] = (await a.repo.listRules(child.id)).filter(r=>r.active)
      const wish = await a.repo.proposeWish(child.id,'积木','gift')
      await a.repo.changeWish(wish.id,'approve',10)
      const pact = await fa.createWishPact(child.id,kid.id,wish.id,[rule.id])
      await fa.sealPact(pact.id,parent.id); await fa.signPact(pact.id,parent.id)
      expect(await a.engine.syncNow()).toBe(true)
      expect(await b.engine.syncNow()).toBe(true)
      expect((await fb.listPacts(child.id))[0].wishPlan?.wishId).toBe(wish.id)
      await fb.signPact(pact.id,kid.id)
      const date = new Intl.DateTimeFormat('sv-SE', { timeZone:'Asia/Shanghai' }).format(new Date())
      await b.repo.setCheck(child.id,rule.id,date,'done',null,{stepsDone:rule.steps})
      expect(await b.engine.syncNow()).toBe(true)
      expect(await a.engine.syncNow()).toBe(true)
      expect(await fa.listSignatures(child.id)).toHaveLength(2)
      expect(await fa.listChecks(child.id)).toHaveLength(0)
      expect(await a.repo.listChecks(child.id)).toHaveLength(1)
      expect(await a.repo.outboxCount()).toBe(0)
      expect(await b.repo.outboxCount()).toBe(0)
    } finally { await closeDevice(a); await closeDevice(b) }
  })
  it('三类新打卡按1/2星跨设备同步，5星可冒险，兑换使用相同余额', async () => {
    const a = await openDevice()
    const b = await openDevice()
    try {
      const child = await a.repo.createProfile({ name: '全全' })
      await a.repo.ensureHabitPlan(child.id)
      const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date())
      const rules = await a.repo.listRules(child.id)
      for (const life of rules.filter(r => r.category === 'life')) await a.repo.setCheck(child.id, life.id, date, 'done')
      await expect(a.engine.claimAdventure(child.id, date, 'meadow')).rejects.toThrow('5')
      const rope = rules.find(r => r.habitKey === 'rope')!
      await a.repo.setCheck(child.id, rope.id, date, 'done', null, { minutes: 5 })
      const adventure = await a.engine.claimAdventure(child.id, date, 'meadow')
      await b.engine.syncNow()
      expect(birdInventory(await a.repo.listAdventures(child.id))).toEqual(birdInventory(await b.repo.listAdventures(child.id)))
      await a.repo.updateProfile(child.id, { buddyAccessory: birdLoot(adventure).key })
      await a.engine.syncNow(); await b.engine.syncNow()
      expect((await b.repo.listProfiles())[0].buddyAccessory).toBe(birdLoot(adventure).key)
      expect((await b.repo.listChecks(child.id)).map(c => c.rewardStars).sort()).toEqual([1, 1, 1, 2])
      await b.repo.ensureHabitPlan(child.id)
      expect((await b.repo.listRules(child.id)).filter(r => r.habitKey)).toHaveLength(6)
      const wish = await b.repo.proposeWish(child.id, '一起去公园', 'picnic')
      await b.repo.changeWish(wish.id, 'approve', 5 + adventure.bonusStars)
      await b.repo.changeWish(wish.id, 'request')
      expect(await b.engine.syncNow()).toBe(true)
      await a.engine.syncNow()
      expect((await a.repo.listWishes(child.id))[0].status).toBe('requested')
    } finally { await closeDevice(a); await closeDevice(b) }
  })
  it('每日冒险先验证任务，跨设备同时出发只获得同一份奖励且能用于兑换', async () => {
    const a = await openDevice()
    const b = await openDevice()
    try {
      const child = await a.repo.createProfile({ name: '全全' })
      const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date())
      await expect(a.engine.claimAdventure(child.id, date, 'meadow')).rejects.toThrow('5')
      for (const rule of (await a.repo.listRules(child.id)).slice(0, 3)) await a.repo.setCheck(child.id, rule.id, date, 'done')
      await a.engine.syncNow(); await b.engine.syncNow()
      const [first, second] = await Promise.all([a.engine.claimAdventure(child.id, date, 'meadow'), b.engine.claimAdventure(child.id, date, 'stream')])
      expect(first.id).toBe(second.id)
      expect(first.bonusStars).toBe(second.bonusStars)
      expect(first.route).toBe(second.route)
      expect([2, 3, 5]).toContain(first.bonusStars)
      await a.engine.syncNow(); await b.engine.syncNow()
      expect(await a.repo.listAdventures(child.id)).toHaveLength(1)
      expect(await b.repo.listAdventures(child.id)).toHaveLength(1)
      const wish = await a.repo.proposeWish(child.id, '一起骑车', 'bicycle')
      await a.repo.changeWish(wish.id, 'approve', 15 + first.bonusStars)
      await a.repo.changeWish(wish.id, 'request')
      expect(await a.engine.syncNow()).toBe(true)
      const forged = await fetch(`${ENDPOINT}/adventureRuns`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...first, bonusStars: 999, updatedAt: '2099-01-01T00:00:00Z' }) })
      expect(forged.status).toBe(400)
      expect((await b.engine.claimAdventure(child.id, date, 'forest')).bonusStars).toBe(first.bonusStars)
      await expect(a.engine.claimAdventure(child.id, '2099-01-01', 'meadow')).rejects.toThrow()
    } finally { await closeDevice(a); await closeDevice(b) }
  })
  it('孩子提出的心愿可由另一设备确认，兑换结果再同步回来', async () => {
    const a = await openDevice()
    const b = await openDevice()
    try {
      const child = await a.repo.createProfile({ name: '全全' })
      const [rule] = await a.repo.listRules(child.id)
      await a.repo.setCheck(child.id, rule.id, '2026-10-18', 'done')
      const wish = await a.repo.proposeWish(child.id, '自己的积木', 'gift')
      await a.repo.updateProfile(child.id, { focusWishId: wish.id })
      expect(await a.engine.syncNow()).toBe(true)
      expect(await b.engine.syncNow()).toBe(true)
      expect((await b.repo.listWishes(child.id))[0].name).toBe('自己的积木')
      expect((await b.repo.getPrimaryProfile())?.focusWishId).toBe(wish.id)
      await b.repo.changeWish(wish.id, 'approve', 5)
      expect(await b.engine.syncNow()).toBe(true)
      expect(await a.engine.syncNow()).toBe(true)
      await a.repo.changeWish(wish.id, 'request')
      expect(await a.engine.syncNow()).toBe(true)
      expect(await b.engine.syncNow()).toBe(true)
      await b.repo.changeWish(wish.id, 'redeem')
      expect(await b.engine.syncNow()).toBe(true)
      expect(await a.engine.syncNow()).toBe(true)
      expect((await a.repo.listWishes(child.id))[0].status).toBe('redeemed')
    } finally { await closeDevice(a); await closeDevice(b) }
  })
  it('一台设备建的档案，另一台设备同步后能看到', async () => {
    const a = await openDevice()
    const b = await openDevice()
    try {
      await a.repo.createProfile({ name: '小满', nickname: '满满' })
      expect(await a.engine.syncNow()).toBe(true)
      expect(await b.engine.syncNow()).toBe(true)

      const profiles = await b.repo.listProfiles()
      expect(profiles).toHaveLength(1)
      expect(profiles[0].name).toBe('小满')
      // 内置规则要跟着档案一起过去，否则另一台设备上规则页是空的
      expect((await b.repo.listRules(profiles[0].id)).length).toBeGreaterThanOrEqual(5)
    } finally {
      await closeDevice(a)
      await closeDevice(b)
    }
  })

  it('两边各自记录，互不覆盖，最后两边都齐全', async () => {
    const a = await openDevice()
    const b = await openDevice()
    try {
      const child = await a.repo.createProfile({ name: '小满' })
      await a.engine.syncNow()
      await b.engine.syncNow()

      // 设备 A 记睡眠，设备 B 记优势事例
      await a.repo.saveDailyLog({
        childId: child.id,
        date: '2026-10-16',
        sleepTime: '22:10',
        wakeTime: '06:40',
      })
      await b.repo.createStrength({
        childId: child.id,
        date: '2026-10-16',
        category: 'care',
        event: '弟弟摔倒',
        childAction: '扶他起来',
        outcome: '弟弟不哭了',
      })

      await a.engine.syncNow()
      await b.engine.syncNow()
      await a.engine.syncNow()
      await b.engine.syncNow()

      for (const device of [a, b]) {
        expect(await device.repo.listDailyLogs(child.id)).toHaveLength(1)
        expect(await device.repo.listStrengths(child.id)).toHaveLength(1)
      }
    } finally {
      await closeDevice(a)
      await closeDevice(b)
    }
  })

  it('删除会同步到另一台设备，不会自己长回来', async () => {
    const a = await openDevice()
    const b = await openDevice()
    try {
      const child = await a.repo.createProfile({ name: '小满' })
      const moment = await a.repo.createStrength({
        childId: child.id,
        date: '2026-10-16',
        category: 'sport',
        event: '自己骑车',
        childAction: '扶稳车把骑了一圈',
        outcome: '成功',
      })
      await a.engine.syncNow()
      await b.engine.syncNow()
      expect(await b.repo.listStrengths(child.id)).toHaveLength(1)

      await a.repo.deleteRecord('strengthMoments', moment.id)
      await a.engine.syncNow()
      await b.engine.syncNow()
      expect(await b.repo.listStrengths(child.id)).toHaveLength(0)

      // 再同步几轮，墓碑生效后不会把删掉的记录又拉回来
      await b.engine.syncNow()
      await a.engine.syncNow()
      expect(await a.repo.listStrengths(child.id)).toHaveLength(0)
    } finally {
      await closeDevice(a)
      await closeDevice(b)
    }
  })

  it('同一条记录两边都改，以较晚的改动为准', async () => {
    const a = await openDevice()
    const b = await openDevice()
    try {
      const child = await a.repo.createProfile({ name: '小满' })
      await a.engine.syncNow()
      await b.engine.syncNow()

      const log = await a.repo.saveDailyLog({
        childId: child.id,
        date: '2026-10-16',
        sleepTime: '22:00',
      })
      await a.engine.syncNow()
      await b.engine.syncNow()

      // 设备 B 把这条改成更晚的时间戳，设备 A 的旧改动不该盖掉它
      await b.repo.saveDailyLog({
        childId: child.id,
        date: '2026-10-16',
        sleepTime: '23:30',
      })
      const stale = await a.database.dailyLogs.get(log.id)
      await a.database.dailyLogs.put({
        ...stale!,
        sleepTime: '21:00',
        updatedAt: '2000-01-01T00:00:00.000Z',
      })
      await a.repo.enqueue('dailyLogs', {
        ...(await a.database.dailyLogs.get(log.id))!,
      })

      await b.engine.syncNow()
      await a.engine.syncNow()
      await b.engine.syncNow()

      const finalA = await a.repo.listDailyLogs(child.id)
      const finalB = await b.repo.listDailyLogs(child.id)
      expect(finalA[0].sleepTime).toBe('23:30')
      expect(finalB[0].sleepTime).toBe('23:30')
    } finally {
      await closeDevice(a)
      await closeDevice(b)
    }
  })

  it('同步失败时改动留在本地队列，服务恢复后自动补传', async () => {
    const broken = await openDevice('http://127.0.0.1:9/api')
    try {
      const child = await broken.repo.createProfile({ name: '小满' })
      await broken.repo.createStrength({
        childId: child.id,
        date: '2026-10-16',
        category: 'solve',
        event: '自己修好了玩具',
        childAction: '找到松动的地方拧紧',
        outcome: '能玩了',
      })

      expect(await broken.engine.syncNow()).toBe(false)
      // 关键：写不上去也不许丢，必须留在队列里等重试
      expect(await broken.repo.outboxCount()).toBeGreaterThan(0)
      expect(broken.engine.getSnapshot().status).toBe('error')
      expect(broken.engine.getSnapshot().lastError).toBeTruthy()
      // 本地照样能用
      expect(await broken.repo.listStrengths(child.id)).toHaveLength(1)

      await broken.engine.setEndpoint(ENDPOINT)
      expect(broken.engine.getSnapshot().pending).toBe(0)

      const other = await openDevice()
      try {
        await other.engine.syncNow()
        expect(await other.repo.listProfiles()).toHaveLength(1)
        expect(await other.repo.listStrengths(child.id)).toHaveLength(1)
      } finally {
        await closeDevice(other)
      }
    } finally {
      await closeDevice(broken)
    }
  })

  it('一台设备清空后，另一台同步时会跟着清空', async () => {
    const a = await openDevice()
    const b = await openDevice()
    try {
      const child = await a.repo.createProfile({ name: '小满' })
      await a.repo.createStrength({
        childId: child.id,
        date: '2026-10-16',
        category: 'care',
        event: '帮妈妈拿东西',
        childAction: '主动帮忙',
        outcome: '妈妈很轻松',
      })
      await a.engine.syncNow()
      await b.engine.syncNow()
      expect(await b.repo.listProfiles()).toHaveLength(1)

      await a.engine.clearEverything()
      expect(await a.repo.listProfiles()).toHaveLength(0)

      expect(await b.engine.syncNow()).toBe(true)
      expect(await b.repo.listProfiles()).toHaveLength(0)
      expect(await b.repo.countAll()).toEqual(
        expect.objectContaining({ strengthMoments: 0, routineRules: 0 }),
      )
    } finally {
      await closeDevice(a)
      await closeDevice(b)
    }
  })
})
