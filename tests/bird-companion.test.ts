import { describe, expect, it, vi } from 'vitest'
import {
  adventureTreasure,
  birdLoot,
  birdInventory,
  buddyBond,
  changeBuddyCare,
  HOME_TREASURES,
  homeTreasureInventory,
  normalizeBuddyCare,
} from '../src/lib/birdCompanion'
import { preparePraise } from '../src/lib/praise'
import type { AdventureRun, BuddyCareState } from '../src/db/types'
import { GrowthDB } from '../src/db/db'
import { createRepo, newId } from '../src/db/repo'

const run: AdventureRun = { id: 'adventure:child:2026-10-19', childId: 'child', date: '2026-10-19', route: 'forest', scene: 2, material: 'leaf', bonusStars: 2, createdAt: '', updatedAt: '' }
describe('小鸟伙伴', () => {
  it('只能换上已获得的物品，档案记录装备并可以收起', async () => {
    const database = new GrowthDB(`bird-${newId()}`)
    try {
      const repo = createRepo(database)
      const child = await repo.createProfile({ name: '全全' })
      await expect(repo.updateProfile(child.id, { buddyAccessory: 'bell' })).rejects.toThrow('还没有')
      await expect(repo.updateProfile(child.id, { buddyHomeDecor: 'gem' })).rejects.toThrow('还没有')
      const adventure = { ...run, childId: child.id, id: `adventure:${child.id}:${run.date}` }
      await database.adventureRuns.put(adventure)
      const item = birdLoot(adventure)
      const treasure = adventureTreasure(adventure)
      await repo.updateProfile(child.id, { buddyAccessory: item.key })
      await repo.updateProfile(child.id, { buddyHomeDecor: treasure.key })
      expect((await repo.listProfiles())[0].buddyAccessory).toBe(item.key)
      expect((await repo.listProfiles())[0].buddyHomeDecor).toBe(treasure.key)
      await repo.updateProfile(child.id, { buddyAccessory: null })
      await repo.updateProfile(child.id, { buddyHomeDecor: null })
      expect((await repo.listProfiles())[0].buddyAccessory).toBeNull()
      expect((await repo.listProfiles())[0].buddyHomeDecor).toBeNull()
    } finally { await database.delete() }
  })
  it('冒险玩具确定且重复同步不重复计数，无有效冒险不凭空获得', () => {
    expect(birdLoot(run)).toEqual(birdLoot({ ...run }))
    expect(birdInventory([run, run])).toHaveLength(1)
    expect(birdInventory([run, run])[0].count).toBe(1)
    expect(birdInventory([{ ...run, deleted: true }])).toEqual([])
    expect(adventureTreasure(run)).toEqual(adventureTreasure({ ...run }))
    expect(HOME_TREASURES.some(item => item.key === adventureTreasure(run).key)).toBe(true)
    expect(homeTreasureInventory([run, run])[0].count).toBe(1)
    expect(homeTreasureInventory([{ ...run, deleted: true }])).toEqual([])
  })
  it('小鸟鼓励仍带姓名和具体任务', () => {
    vi.spyOn(HTMLMediaElement.prototype,'play').mockResolvedValue(undefined)
    vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{})
    expect(preparePraise({ name: '全全', title: '整理衣服' }).text).toContain('全全，你完成了整理衣服')
  })
  it('照料每天首次增加亲密值，重复动作不刷分', () => {
    const first = changeBuddyCare(undefined, 'feed', '2026-10-20T09:00:00+08:00', '2026-10-20')
    const repeat = changeBuddyCare(first, 'feed', '2026-10-20T09:05:00+08:00', '2026-10-20')
    expect(first).toMatchObject({ completed: ['feed'], xp: 1, sleepingSince: null })
    expect(repeat).toMatchObject({ completed: ['feed'], xp: 1 })
    expect(normalizeBuddyCare({ ...repeat, date: '2026-10-19' }, '2026-10-20')).toEqual({
      date: '2026-10-20',
      completed: [],
      xp: 1,
      sleepingSince: null,
    })
  })
  it('睡觉和叫醒是可恢复状态，睡觉不会重复加亲密值', () => {
    const slept = changeBuddyCare(undefined, 'sleep', '2026-10-20T21:30:00+08:00', '2026-10-20')
    const repeated = changeBuddyCare(slept, 'sleep', '2026-10-20T21:40:00+08:00', '2026-10-20')
    const awake = changeBuddyCare(repeated, 'wake', '2026-10-20T22:00:00+08:00', '2026-10-20')
    expect(slept).toMatchObject({ xp: 1, sleepingSince: '2026-10-20T21:30:00+08:00' })
    expect(repeated).toMatchObject({ xp: 1, sleepingSince: '2026-10-20T21:40:00+08:00' })
    expect(awake).toMatchObject({ xp: 1, sleepingSince: null, completed: ['sleep'] })
  })
  it('亲密等级只向上累计，冒险也计入但不要求连续', () => {
    const care: BuddyCareState = { date: '2026-10-20', completed: ['feed'], xp: 2, sleepingSince: null }
    expect(buddyBond([], care)).toMatchObject({ level: 1, name: '刚认识', totalXp: 2 })
    expect(buddyBond([run], care)).toMatchObject({ level: 2, name: '好朋友', totalXp: 5 })
  })
})
