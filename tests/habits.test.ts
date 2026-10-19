import { afterEach, describe, expect, it } from 'vitest'
import { GrowthDB } from '../src/db/db'
import { createRepo, newId } from '../src/db/repo'
import { starBalance } from '../src/lib/rewards'
let database: GrowthDB
afterEach(async () => { await database?.delete() })
describe('三类家庭打卡', () => {
  it('升级只暂停旧清单，保留历史5星；新计划三项生活1星、两项运动和学习各2星', async () => {
    database = new GrowthDB(`habits-${newId()}`)
    const repo = createRepo(database)
    const child = await repo.createProfile({ name: '全全' })
    const [old] = await repo.listRules(child.id)
    await repo.setCheck(child.id, old.id, '2026-10-18', 'done')
    await repo.ensureHabitPlan(child.id); await repo.ensureHabitPlan(child.id)
    const plan = (await repo.listRules(child.id)).filter(r => r.habitKey)
    expect(plan).toHaveLength(6)
    expect(plan.filter(r => r.category === 'life').map(r => r.rewardStars)).toEqual([1, 1, 1])
    expect(plan.filter(r => r.category === 'sport').map(r => r.rewardStars)).toEqual([2, 2])
    const life = plan.filter(r => r.category === 'life')
    for (const rule of life) await repo.setCheck(child.id, rule.id, '2026-10-19', 'done')
    const rope = plan.find(r => r.habitKey === 'rope')!
    await expect(repo.setCheck(child.id, rope.id, '2026-10-19', 'done', null, { minutes: 4 })).rejects.toThrow('5')
    await repo.setCheck(child.id, rope.id, '2026-10-19', 'done', null, { minutes: 5 })
    await repo.setCheck(child.id, rope.id, '2026-10-19', 'done', null, { minutes: 6 })
    expect(starBalance([], await repo.listChecks(child.id), []).earned).toBe(10)
    expect((await repo.listChecks(child.id)).filter(c => c.ruleId === rope.id)).toHaveLength(1)
  })
})
