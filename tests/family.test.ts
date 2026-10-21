import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Dexie from 'dexie'
import { GrowthDB } from '../src/db/db'
import { createRepo, newId } from '../src/db/repo'
import { createFamilyRepo, pactIsActive } from '../src/lib/family'
import { zodiacProgress } from '../src/lib/constellations'
import { buildExportBundle, importBundle } from '../src/lib/transfer'

let db: GrowthDB
let family: ReturnType<typeof createFamilyRepo>
let childId: string
beforeEach(async () => {
  db = new GrowthDB(`family-${newId()}`)
  childId = (await createRepo(db).createProfile({ name: '小满' })).id
  family = createFamilyRepo(db)
})
afterEach(async () => { await db.delete() })
async function members() { return family.ensureMembers(childId) }
async function signedPact() {
  const [parent, child] = await members()
  const pact = await family.createPact(childId, parent.id, '一起长大', [{ memberId: child.id, text: '睡前收好玩具' }, { memberId: parent.id, text: '陪伴时放下手机' }])
  await family.sealPact(pact.id, parent.id)
  await family.signPact(pact.id, parent.id)
  await family.signPact(pact.id, child.id)
  return { parent, child, pact }
}
describe('家庭公约与权限', () => {
  it('旧档案初始化幂等，不改旧规则和记录', async () => {
    const rules = await db.routineRules.toArray()
    await Promise.all([members(), members()])
    expect(await db.familyMembers.count()).toBe(2)
    expect(await db.routineRules.toArray()).toEqual(rules)
  })
  it('孩子能提议和修改草稿，不能添加家长或发起签订', async () => {
    const [, child] = await members()
    await expect(family.addMember(childId, child.id, '妈妈', 'parent')).rejects.toThrow('家长')
    const pact = await family.createPact(childId, child.id, '共同商量', [{ memberId: child.id, text: '整理书包' }])
    await family.updateDraft(pact.id, child.id, '商量好了', pact.clauses)
    await expect(family.sealPact(pact.id, child.id)).rejects.toThrow('家长')
  })
  it('需要每个参与者亲自签订，签订中的内容不可改；重复签订幂等', async () => {
    const { parent, child, pact } = await signedPact()
    const saved = (await family.listPacts(childId))[0]
    expect(pactIsActive(saved, await family.listSignatures(childId))).toBe(true)
    await family.signPact(pact.id, child.id)
    expect(await db.pactSignatures.count()).toBe(2)
    await expect(family.updateDraft(pact.id, parent.id, '悄悄改动', pact.clauses)).rejects.toThrow('重新')
  })
  it('未签齐不能打卡；每天自己打卡一次，双方互相鼓励，不能代赞', async () => {
    const [parent, child] = await members()
    const pact = await family.createPact(childId, parent.id, '小约定', [{ memberId: child.id, text: '收玩具' }, { memberId: parent.id, text: '陪伴' }])
    await family.sealPact(pact.id, parent.id)
    await family.signPact(pact.id, parent.id)
    await expect(family.checkIn(pact.id, 0, child.id, '2026-10-20')).rejects.toThrow('签订')
    await family.signPact(pact.id, child.id)
    await expect(family.checkIn(pact.id, 0, parent.id, '2026-10-20')).rejects.toThrow('自己')
    await Promise.all([family.checkIn(pact.id, 0, child.id, '2026-10-20'), family.checkIn(pact.id, 0, child.id, '2026-10-20')])
    const [check] = await family.listChecks(childId)
    expect(await db.familyChecks.count()).toBe(1)
    await expect(family.encourage(check.id, child.id)).rejects.toThrow('家人')
    await family.encourage(check.id, parent.id)
    await family.encourage(check.id, parent.id)
    expect(await db.familyReactions.count()).toBe(1)
  })
  it('跨孩子档案、无效日期和空条目不能写入', async () => {
    const { parent, child, pact } = await signedPact()
    const other = await createRepo(db).createProfile({ name: '另一个孩子' })
    const [otherParent] = await family.ensureMembers(other.id)
    await expect(family.signPact(pact.id, otherParent.id)).rejects.toThrow()
    await expect(family.checkIn(pact.id, 0, child.id, '2026-02-30')).rejects.toThrow('日期')
    await expect(family.createPact(childId, parent.id, '约定', [{ memberId: child.id, text: ' ' }])).rejects.toThrow()
  })
  it('草稿撤回只限家长，已经签订的公约保留记录', async () => {
    const { parent, child, pact } = await signedPact()
    await expect(family.archivePact(pact.id, child.id)).rejects.toThrow('家长')
    await family.archivePact(pact.id, parent.id)
    await expect(family.checkIn(pact.id, 0, child.id, '2026-10-20')).rejects.toThrow()
    expect(await db.pactSignatures.count()).toBe(2)
  })
  it('家庭数据进入离线队列并可完整备份恢复', async () => {
    const { parent, child, pact } = await signedPact()
    await family.checkIn(pact.id, 0, child.id, '2026-10-20')
    const [record] = await family.listChecks(childId)
    await family.encourage(record.id, parent.id)
    expect(await db.syncQueue.count()).toBeGreaterThanOrEqual(7)
    const bundle = await buildExportBundle(db)
    const mirror = new GrowthDB(`mirror-${newId()}`)
    try {
      const report = await importBundle(mirror, bundle)
      expect(report.skippedInvalid).toBe(0)
      expect(await mirror.familyMembers.count()).toBe(2)
      expect(await mirror.pactSignatures.count()).toBe(2)
      expect(await mirror.familyChecks.count()).toBe(1)
      expect(await mirror.familyReactions.count()).toBe(1)
    } finally { await mirror.delete() }
  })
  it('v4升级保留旧记录、设置、待同步队列', async () => {
    const name = `upgrade-${newId()}`
    const old = new Dexie(name)
    old.version(4).stores({ childProfiles: 'id', settings: 'key', syncQueue: '++seq, entity, &[entity+recordId]' })
    await old.table('childProfiles').put({ id: 'old', name: '旧档案' })
    await old.table('settings').put({ key: 'keep', value: 'true' })
    await old.table('syncQueue').put({ entity: 'childProfiles', recordId: 'old', payload: { id: 'old' } })
    old.close()
    const upgraded = new GrowthDB(name)
    try {
      expect((await upgraded.childProfiles.get('old'))?.name).toBe('旧档案')
      expect((await upgraded.settings.get('keep'))?.value).toBe('true')
      expect(await upgraded.syncQueue.count()).toBe(1)
      expect(await upgraded.familyMembers.count()).toBe(0)
    } finally { await upgraded.delete() }
  })
  it('星座使用累计成长光点，兑换不影响；重复打卡不重复点亮', () => {
    expect(zodiacProgress(5).lit).toBe(5)
    expect(zodiacProgress(10000).complete).toBe(true)
  })
})
