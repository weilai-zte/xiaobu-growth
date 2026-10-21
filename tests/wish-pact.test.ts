import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { GrowthDB } from '../src/db/db'
import { createRepo, newId } from '../src/db/repo'
import { createFamilyRepo, pactIsActive } from '../src/lib/family'
import { buildExportBundle, importBundle } from '../src/lib/transfer'
import { todayKey } from '../src/lib/date'
import { starBalance } from '../src/lib/rewards'
let db: GrowthDB
beforeEach(() => { db = new GrowthDB(`wish-pact-${newId()}`) })
afterEach(async () => { await db.delete() })
async function setup() {
  const repo = createRepo(db), family = createFamilyRepo(db)
  const child = await repo.createProfile({name:'小满'})
  await repo.ensureHabitPlan(child.id)
  const members = await family.ensureMembers(child.id)
  const rules = (await repo.listRules(child.id)).filter(r => r.active)
  const wish = await repo.proposeWish(child.id,'一盒积木','gift')
  return { repo, family, child, members, rules, wish }
}
describe('心愿选择已有打卡后共同签订', () => {
  it('家长上架时一次写入奖励和价格，非法价格不遗留半成品心愿',async()=>{
    const {repo,child}=await setup()
    const count=await db.wishes.count()
    await expect(repo.proposeWish(child.id,'新奖励','gift',0)).rejects.toThrow()
    expect(await db.wishes.count()).toBe(count)
    const reward=await repo.proposeWish(child.id,'已定价奖励','gift',10)
    expect(reward.status).toBe('approved')
    expect(reward.cost).toBe(10)
    expect((await db.wishes.get(reward.id))?.status).toBe('approved')
  })
  it('引用已有任务，重复提交只生成一份草稿；不动原规则、历史和余额', async () => {
    const {repo,family,child,members,rules,wish} = await setup()
    await repo.setCheck(child.id,rules[0].id,todayKey(),'done',null,{stepsDone:rules[0].steps})
    const before = await db.routineRules.toArray(), history = await db.routineChecks.toArray()
    const [a,b] = await Promise.all([family.createWishPact(child.id,members[1].id,wish.id,[rules[0].id]),family.createWishPact(child.id,members[1].id,wish.id,[rules[0].id])])
    expect(a.id).toBe(b.id)
    expect(a.wishPlan?.ruleIds).toEqual([rules[0].id])
    expect(new Set(a.clauses.map(c=>c.memberId))).toEqual(new Set(members.map(m=>m.id)))
    expect(await db.routineRules.toArray()).toEqual(before)
    expect(await db.routineChecks.toArray()).toEqual(history)
    expect(await db.familyChecks.count()).toBe(0)
  })
  it('家长定价确认后才能签订；每位家人分别签齐；关联内容不可改写', async () => {
    const {repo,family,child,members,rules,wish} = await setup()
    const pact = await family.createWishPact(child.id,members[1].id,wish.id,[rules[0].id,rules[3].id])
    await expect(family.sealPact(pact.id,members[0].id)).rejects.toThrow('星数')
    await repo.changeWish(wish.id,'approve',10)
    await family.sealPact(pact.id,members[0].id)
    let saved = (await family.listPacts(child.id))[0]
    expect(saved.wishPlan?.rewardCost).toBe(10)
    await family.signPact(pact.id,members[0].id)
    expect(pactIsActive(saved,await family.listSignatures(child.id))).toBe(false)
    await family.signPact(pact.id,members[1].id)
    saved = (await family.listPacts(child.id))[0]
    expect(pactIsActive(saved,await family.listSignatures(child.id))).toBe(true)
    await expect(family.updateWishPact(pact.id,members[1].id,[rules[1].id])).rejects.toThrow('重新')
    await expect(family.checkIn(pact.id,0,members[1].id)).rejects.toThrow('原有打卡')
    expect(await db.familyChecks.count()).toBe(0)
    expect(starBalance([],await repo.listChecks(child.id),await repo.listWishes(child.id),[]).earned).toBe(0)
  })
  it('拒绝空选择、停用任务和跨档案引用，未签订可以重新选择', async () => {
    const {repo,family,child,members,rules,wish} = await setup()
    await expect(family.createWishPact(child.id,members[1].id,wish.id,[])).rejects.toThrow('选择')
    const other = await repo.createProfile({name:'另一个孩子'})
    const [otherRule] = await repo.listRules(other.id)
    await expect(family.createWishPact(child.id,members[1].id,wish.id,[otherRule.id])).rejects.toThrow()
    await repo.updateRule(rules[0].id,{active:false})
    await expect(family.createWishPact(child.id,members[1].id,wish.id,[rules[0].id])).rejects.toThrow('启用')
    const pact = await family.createWishPact(child.id,members[1].id,wish.id,[rules[1].id])
    await family.updateWishPact(pact.id,members[1].id,[rules[2].id])
    expect((await family.listPacts(child.id))[0].wishPlan?.ruleIds).toEqual([rules[2].id])
  })
  it('新关联公约可备份恢复；旧公约无关联字段仍正常', async () => {
    const {repo,family,child,members,rules,wish} = await setup()
    await repo.changeWish(wish.id,'approve',10)
    const pact = await family.createWishPact(child.id,members[1].id,wish.id,[rules[0].id])
    await family.sealPact(pact.id,members[0].id)
    const bundle = await buildExportBundle(db), mirror = new GrowthDB(`mirror-${newId()}`)
    try {
      expect((await importBundle(mirror,bundle)).skippedInvalid).toBe(0)
      expect((await mirror.growthPacts.get(pact.id))?.wishPlan?.wishId).toBe(wish.id)
    } finally { await mirror.delete() }
  })
})

it('家长可修改未申请奖励，申请后内容与价格保持不变',async()=>{
 const {repo,child,rules,wish}=await setup()
 await repo.editWish(wish.id,'新的积木','gift',1)
 await repo.setCheck(child.id,rules.find(r=>r.habitKey==='body')!.id,todayKey(),'done')
 await repo.changeWish(wish.id,'request')
 await expect(repo.editWish(wish.id,'被改的积木','gift',9)).rejects.toThrow('不能修改')
 const saved=(await repo.listWishes(child.id)).find(w=>w.id===wish.id)!
 expect(saved.name).toBe('新的积木');expect(saved.cost).toBe(1);expect(saved.status).toBe('requested')
})
