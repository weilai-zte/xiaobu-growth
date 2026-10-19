import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GrowthDB } from '../src/db/db'
import { createRepo, newId } from '../src/db/repo'
import { focusedWish, growthTrail, starBalance } from '../src/lib/rewards'
import { buildExportBundle, importBundle, rowsToCsv } from '../src/lib/transfer'

let db: GrowthDB
let repo: ReturnType<typeof createRepo>
beforeEach(() => { db = new GrowthDB(`rewards-${newId()}`); repo = createRepo(db) })
afterEach(async () => { await db.delete() })
async function setup() {
  const child = await repo.createProfile({ name: '全全' })
  const [rule] = await repo.listRules(child.id)
  return { child, rule }
}
async function balance(childId: string) { return starBalance(await repo.listTaskRecords(childId), await repo.listChecks(childId), await repo.listWishes(childId)) }

describe('星星与心愿', () => {
  it('脚印只来自有效完成记录；重复记录、删除和空白日期不会编造成长', async () => {
    const { child, rule } = await setup()
    await repo.setCheck(child.id, rule.id, '2026-10-16', 'done')
    await repo.setCheck(child.id, rule.id, '2026-10-17', 'partial')
    const deleted = await repo.setCheck(child.id, rule.id, '2026-10-18', 'done')
    await repo.deleteRecord('routineChecks', deleted.id)
    const trail = growthTrail([], await repo.listChecks(child.id), '2026-10-19')
    expect(trail).toHaveLength(7)
    expect(trail.filter(d => d.done).map(d => d.date)).toEqual(['2026-10-16'])
    expect(growthTrail([], [], '2026-10-19').some(d => d.done)).toBe(false)
  })
  it('优先心愿会保存，失效或兑现后自然回到其他可用心愿', async () => {
    const { child } = await setup()
    const first = await repo.proposeWish(child.id, '一起去公园', 'picnic')
    const second = await repo.proposeWish(child.id, '一起做小饼干', 'bake')
    await repo.updateProfile(child.id, { focusWishId: second.id })
    const saved = await repo.getPrimaryProfile()
    expect(focusedWish(await repo.listWishes(child.id), saved?.focusWishId)?.id).toBe(second.id)
    await repo.deleteRecord('wishes', second.id)
    expect(focusedWish(await repo.listWishes(child.id), saved?.focusWishId)?.id).toBe(first.id)
    expect(focusedWish([{ ...first, status: 'redeemed' }], first.id)).toBeUndefined()
  })
  it('重复完成同一清单只得一次星星，删除记录撤回星星', async () => {
    const { child, rule } = await setup()
    await repo.setCheck(child.id, rule.id, '2026-10-18', 'done')
    const check = await repo.setCheck(child.id, rule.id, '2026-10-18', 'done')
    expect((await balance(child.id)).earned).toBe(5)
    await repo.deleteRecord('routineChecks', check.id)
    expect((await balance(child.id)).earned).toBe(0)
  })
  it('心愿需要正整数星数，余额不足不能申请', async () => {
    const { child } = await setup()
    await expect(repo.proposeWish(child.id, ' ', 'gift')).rejects.toThrow()
    const wish = await repo.proposeWish(child.id, '积木', 'gift')
    await expect(repo.changeWish(wish.id, 'approve', 0)).rejects.toThrow()
    await repo.changeWish(wish.id, 'approve', 10)
    await expect(repo.changeWish(wish.id, 'request')).rejects.toThrow('还没攒够')
  })
  it('申请预留星星，取消释放，并发点击只兑换一次', async () => {
    const { child, rule } = await setup()
    await repo.setCheck(child.id, rule.id, '2026-10-18', 'done')
    const wish = await repo.proposeWish(child.id, '一起去公园', 'rocket')
    await repo.changeWish(wish.id, 'approve', 5)
    await repo.changeWish(wish.id, 'request')
    expect((await balance(child.id)).available).toBe(0)
    await repo.changeWish(wish.id, 'cancel')
    expect((await balance(child.id)).available).toBe(5)
    await repo.changeWish(wish.id, 'request')
    const result = await Promise.allSettled([repo.changeWish(wish.id, 'redeem'), repo.changeWish(wish.id, 'redeem')])
    expect(result.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect(await balance(child.id)).toMatchObject({ earned: 5, spent: 5, available: 0 })
  })
  it('新心愿进入同步队列并可导出和恢复，重复导入不会重复', async () => {
    repo.setWriteHook((entity, row) => repo.enqueue(entity, row))
    const { child } = await setup()
    const wish = await repo.proposeWish(child.id, '故事书', 'book')
    expect((await repo.listOutbox()).some(row => row.recordId === wish.id && row.entity === 'wishes')).toBe(true)
    const bundle = await buildExportBundle(db)
    expect(rowsToCsv(bundle.data.wishes, 'wishes')).toContain('故事书')
    const restored = new GrowthDB(`restore-${newId()}`)
    try {
      await importBundle(restored, bundle)
      await importBundle(restored, bundle)
      expect(await restored.wishes.count()).toBe(1)
      expect((await restored.wishes.get(wish.id))?.name).toBe('故事书')
    } finally { await restored.delete() }
  })
})
