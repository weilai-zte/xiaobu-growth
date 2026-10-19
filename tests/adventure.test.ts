import { describe, expect, it } from 'vitest'
import { birdStage, dailyActionStars, adventureDay, validAdventure } from '../src/lib/adventure'
import { starBalance } from '../src/lib/rewards'
import type { AdventureRun, RoutineCheck } from '../src/db/types'

const date = '2026-10-19'
const run = { id: `adventure:child:${date}`, childId: 'child', date, route: 'meadow', scene: 0, material: 'leaf', bonusStars: 3, createdAt: `${date}T08:00:00.000Z`, updatedAt: `${date}T08:00:00.000Z` } as AdventureRun
describe('小步的成长与冒险', () => {
  it('从蛋开始，按累计冒险成长；不要求连续天数', () => {
    expect(birdStage(0).key).toBe('egg')
    expect(birdStage(1).key).toBe('crack')
    expect(birdStage(2).key).toBe('hatch')
    expect(birdStage(5).key).toBe('young')
    expect(birdStage(9).key).toBe('adult')
    expect(birdStage(14).key).toBe('nest')
    expect(birdStage(21).key).toBe('home')
  })
  it('今日门槛只看当天真实任务，重复项、补记到昨天和删除项不凑数', () => {
    const checks = [{ ruleId: 'a', date, status: 'done' }, { ruleId: 'a', date, status: 'done' }, { ruleId: 'b', date, status: 'done', deleted: true }, { ruleId: 'c', date: '2026-10-18', status: 'done' }] as RoutineCheck[]
    expect(dailyActionStars([], checks, date)).toBe(5)
  })
  it('奖励计入可兑换余额，同一冒险不能重复计分，也不增加日常任务门槛进度', () => {
    expect(starBalance([], [], [], [run, run])).toMatchObject({ earned: 3, available: 3, bonus: 3 })
    expect(dailyActionStars([], [], date)).toBe(0)
    expect(starBalance([], [], [], [{ ...run, deleted: true }]).available).toBe(0)
  })
  it('校验固定每日 ID、奖励范围、路线与日期；家庭日按上海时区', () => {
    expect(validAdventure(run)).toBe(true)
    for (const patch of [{ bonusStars: 999 }, { bonusStars: 2.5 }, { id: 'random' }, { route: 'invalid' }, { date: '2026-02-30' }]) expect(validAdventure({ ...run, ...patch })).toBe(false)
    expect(adventureDay(new Date('2026-10-18T17:00:00Z'))).toBe(date)
  })
})
