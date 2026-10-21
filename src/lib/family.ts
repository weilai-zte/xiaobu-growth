import type { Table } from 'dexie'
import { db, type GrowthDB, type EntityName } from '../db/db'
import type { Base, FamilyMember, GrowthPact, PactSignature } from '../db/types'
import { isDayKey, nowISO, todayKey } from './date'
import { recordStars } from './habits'

type FamilyEntity = 'familyMembers' | 'growthPacts' | 'pactSignatures' | 'familyChecks' | 'familyReactions'
const text = (value: unknown, max: number) => typeof value === 'string' && value.trim().length > 0 && value.length <= max
export function validWishPlan(value: unknown, sealed = false): boolean {
  if (value === undefined) return true
  if (!value || typeof value !== 'object') return false
  const p = value as GrowthPact['wishPlan']
  return !!p && (!sealed || p.rewardCost !== null) && text(p.wishId, 500) && text(p.rewardName, 80) && (p.rewardCost === null || (Number.isInteger(p.rewardCost) && p.rewardCost! > 0 && p.rewardCost! <= 100000)) && Array.isArray(p.ruleIds) && p.ruleIds.length > 0 && p.ruleIds.length <= 10 && p.ruleIds.every(id => text(id, 500)) && new Set(p.ruleIds).size === p.ruleIds.length
}
export function validFamilyRow(entity: EntityName, row: Record<string, unknown>): boolean {
  if (!text(row.id, 500) || !text(row.childId, 200)) return false
  if (entity === 'familyMembers') return text(row.name, 30) && ['parent', 'child'].includes(String(row.role))
  if (entity === 'growthPacts') return validWishPlan(row.wishPlan, row.sealed === true) && text(row.title, 60) && text(row.authorId, 500) && typeof row.sealed === 'boolean' && typeof row.archived === 'boolean' && Array.isArray(row.clauses) && row.clauses.length > 0 && row.clauses.length <= 12 && row.clauses.every(c => c && text(c.memberId, 500) && text(c.text, 120))
  if (entity === 'pactSignatures') return text(row.pactId, 500) && text(row.memberId, 500)
  if (entity === 'familyChecks') return text(row.pactId, 500) && text(row.memberId, 500) && Number.isInteger(row.clause) && Number(row.clause) >= 0 && Number(row.clause) < 12 && typeof row.date === 'string' && isDayKey(row.date)
  if (entity === 'familyReactions') return text(row.checkId, 1500) && text(row.memberId, 500)
  return false
}
export function pactIsActive(pact: GrowthPact, signatures: PactSignature[]) {
  return !pact.deleted && !pact.archived && pact.sealed && [...new Set(pact.clauses.map(c => c.memberId))].every(id => signatures.some(s => !s.deleted && s.pactId === pact.id && s.memberId === id))
}
export function createFamilyRepo(database: GrowthDB) {
  const alive = <T extends Base>(rows: T[]) => rows.filter(r => !r.deleted)
  const listMembers = async (childId: string) => alive(await database.familyMembers.where('childId').equals(childId).toArray())
  const listPacts = async (childId: string) => alive(await database.growthPacts.where('childId').equals(childId).toArray())
  const listSignatures = async (childId: string) => alive(await database.pactSignatures.where('childId').equals(childId).toArray())
  const listChecks = async (childId: string) => alive(await database.familyChecks.where('childId').equals(childId).toArray())
  const listReactions = async (childId: string) => alive(await database.familyReactions.where('childId').equals(childId).toArray())
  // 业务记录与离线队列在同一事务内提交；新增实体不依赖旧同步回调。
  const transact = <T>(work: () => Promise<T>) => database.transaction('rw', [database.familyMembers, database.growthPacts, database.pactSignatures, database.familyChecks, database.familyReactions, database.childProfiles, database.routineRules, database.wishes, database.syncQueue], work)
  async function write<T extends Base>(entity: FamilyEntity, row: T) {
    if (!validFamilyRow(entity, row as unknown as Record<string, unknown>)) throw new Error('请检查名称、约定内容和参与成员')
    await (database[entity] as unknown as Table<T, string>).put(row)
    const queued = await database.syncQueue.where('[entity+recordId]').equals([entity, row.id]).first()
    await database.syncQueue.put({ ...(queued?.seq ? { seq: queued.seq } : {}), entity, recordId: row.id, payload: row as unknown as Record<string, unknown>, enqueuedAt: nowISO() })
    return row
  }
  const stamp = () => { const ts = nowISO(); return { createdAt: ts, updatedAt: ts } }
  async function member(childId: string, id: string, parent = false) {
    const row = await database.familyMembers.get(id)
    if (!row || row.deleted || row.childId !== childId) throw new Error('请先选择这个家庭的成员')
    if (parent && row.role !== 'parent') throw new Error('这项操作需要家长完成')
    return row
  }
  async function pact(id: string) {
    const row = await database.growthPacts.get(id)
    if (!row || row.deleted || row.archived) throw new Error('这个公约已收起，请选择正在使用的公约')
    return row
  }
  async function validateClauses(childId: string, clauses: GrowthPact['clauses']) {
    if (!Array.isArray(clauses) || !clauses.length || clauses.length > 12) throw new Error('请写下 1–12 条共同约定')
    for (const clause of clauses) {
      if (!text(clause.text, 120)) throw new Error('每条约定请写 1–120 字')
      await member(childId, clause.memberId)
    }
  }
  async function ensureMembers(childId: string) {
    return transact(async () => {
      const profile = await database.childProfiles.get(childId)
      if (!profile || profile.deleted) throw new Error('请先建立孩子档案')
      const rows = await listMembers(childId)
      // 名称使用已有档案；家长只创建角色称呼，不假定爸爸/妈妈身份。
      for (const row of [
        { id: `member-parent:${childId}`, childId, name: '家长', role: 'parent' as const },
        { id: `member-child:${childId}`, childId, name: profile.nickname || profile.name, role: 'child' as const },
      ]) if (!rows.some(m => m.role === row.role)) await write('familyMembers', { ...row, ...stamp() })
      return (await listMembers(childId)).sort((a, b) => a.role === b.role ? a.createdAt.localeCompare(b.createdAt) : a.role === 'parent' ? -1 : 1)
    })
  }
  async function addMember(childId: string, actorId: string, name: string, role: FamilyMember['role']) {
    return transact(async () => { await member(childId, actorId, true); return write('familyMembers', { id: crypto.randomUUID(), childId, name: name.trim(), role, ...stamp() }) })
  }
  async function renameMember(id: string, actorId: string, name: string) {
    return transact(async () => {
      const old = await database.familyMembers.get(id)
      if (!old || old.deleted) throw new Error('找不到这位家人')
      await member(old.childId, actorId, true)
      return write('familyMembers', { ...old, name: name.trim(), updatedAt: nowISO() })
    })
  }
  async function createPact(childId: string, actorId: string, title: string, clauses: GrowthPact['clauses'], replacesPactId?: string, ruleIds?: string[]) {
    return transact(async () => {
      await member(childId, actorId); await validateClauses(childId, clauses)
      if(replacesPactId){const previous=await pact(replacesPactId);if(previous.childId!==childId||!previous.sealed||previous.wishPlan)throw new Error('请选择这个孩子的已签公约')}
      if(ruleIds) for(const id of ruleIds){const rule=await database.routineRules.get(id);if(!rule||rule.deleted||rule.childId!==childId)throw new Error('打卡项目不属于这个孩子')}
      return write('growthPacts', { id: crypto.randomUUID(), childId, title: title.trim(), clauses: clauses.map(c => ({ ...c, text: c.text.trim() })), authorId: actorId, sealed: false, archived: false, ...(replacesPactId?{replacesPactId}:{}), ...(ruleIds?{ruleIds}:{}), ...stamp() })
    })
  }
  async function wishDraft(childId: string, wishId: string, ruleIds: string[]) {
    const wish = await database.wishes.get(wishId)
    if (!wish || wish.deleted || wish.childId !== childId || wish.status === 'redeemed') throw new Error('请选择这个孩子尚未兑现的心愿')
    if (!ruleIds.length || ruleIds.length > 10 || new Set(ruleIds).size !== ruleIds.length) throw new Error('请选择 1–10 项已有打卡')
    const rules = await Promise.all(ruleIds.map(id => database.routineRules.get(id)))
    if (rules.some(r => !r || r.deleted || !r.active || r.childId !== childId)) throw new Error('请选择这个孩子已启用的打卡')
    const members = await listMembers(childId)
    const child = members.find(m => m.role === 'child')
    if (!child || !members.some(m => m.role === 'parent')) throw new Error('需要家长和孩子一起参与')
    const clauses = rules.map(r => ({ memberId: child.id, text: `${r!.title}（完成得${recordStars(r!)}星${r!.minMinutes ? `，至少${r!.minMinutes}分钟` : ''}）` }))
    for (const m of members) if (m.id !== child.id) clauses.push({ memberId: m.id, text: m.role === 'parent' ? '我会陪伴和鼓励，攒够约定的星星后兑现心愿。' : '我会鼓励家人，一起坚持自己的好习惯。' })
    await validateClauses(childId, clauses)
    return { wishPlan: { wishId, ruleIds: [...ruleIds], rewardName: wish.name, rewardCost: wish.cost }, clauses }
  }
  async function createWishPact(childId: string, actorId: string, wishId: string, ruleIds: string[]) {
    return transact(async () => {
      await member(childId, actorId)
      const existing = (await listPacts(childId)).find(p => !p.archived && p.wishPlan?.wishId === wishId)
      if (existing) return existing
      const draft = await wishDraft(childId, wishId, ruleIds)
      return write('growthPacts', { id: crypto.randomUUID(), childId, title: '一起攒星，实现心愿', authorId: actorId, sealed: false, archived: false, ...draft, ...stamp() })
    })
  }
  async function updateWishPact(id: string, actorId: string, ruleIds: string[]) {
    return transact(async () => {
      const old = await pact(id); await member(old.childId, actorId)
      if (old.sealed) throw new Error('签订内容已固定，修改需要新建公约并重新签订')
      if (!old.wishPlan) throw new Error('这不是心愿攒星公约')
      const draft = await wishDraft(old.childId, old.wishPlan.wishId, ruleIds)
      return write('growthPacts', { ...old, ...draft, updatedAt: nowISO() })
    })
  }
  async function updateDraft(id: string, actorId: string, title: string, clauses: GrowthPact['clauses'], ruleIds?: string[]) {
    return transact(async () => {
      const old = await pact(id); await member(old.childId, actorId)
      if (old.sealed) throw new Error('签订内容已固定，修改需要新建公约并重新签订')
      if (old.wishPlan) throw new Error('请在心愿里重新选择打卡')
      await validateClauses(old.childId, clauses)
      return write('growthPacts', { ...old, ...(ruleIds?{ruleIds}:{}), title: title.trim(), clauses: clauses.map(c => ({ ...c, text: c.text.trim() })), updatedAt: nowISO() })
    })
  }
  async function sealPact(id: string, actorId: string) {
    return transact(async () => {
      const old = await pact(id); await member(old.childId, actorId, true)
      await validateClauses(old.childId, old.clauses)
      if (!old.sealed) {
        let wishPlan = old.wishPlan
        if (wishPlan) {
          const fresh = await wishDraft(old.childId, wishPlan.wishId, wishPlan.ruleIds)
          if (!fresh.wishPlan.rewardCost) throw new Error('请先在心愿里约定兑换星数')
          if (JSON.stringify(fresh.clauses) !== JSON.stringify(old.clauses)) throw new Error('打卡或成员已变化，请重新选择打卡再确认')
          wishPlan = fresh.wishPlan
        }
        await write('growthPacts', { ...old, ...(wishPlan ? { wishPlan } : {}), sealed: true, updatedAt: nowISO() })
      }
    })
  }
  async function signPact(id: string, actorId: string) {
    return transact(async () => {
      const old = await pact(id); await member(old.childId, actorId)
      if (!old.sealed) throw new Error('请先请家长发起签订')
      if (!old.clauses.some(c => c.memberId === actorId)) throw new Error('这份公约没有你的约定')
      const signatureId = `signature:${id}:${actorId}`
      if (!await database.pactSignatures.get(signatureId)) await write('pactSignatures', { id: signatureId, childId: old.childId, pactId: id, memberId: actorId, ...stamp() })
      if(old.replacesPactId && pactIsActive(old,await listSignatures(old.childId))){const previous=await database.growthPacts.get(old.replacesPactId);if(previous&&!previous.archived)await write('growthPacts',{...previous,archived:true,updatedAt:nowISO()})}
    })
  }
  async function checkIn(id: string, clause: number, actorId: string, date = todayKey()) {
    return transact(async () => {
      const old = await pact(id); await member(old.childId, actorId)
      if (old.wishPlan) throw new Error('请回到原有打卡图卡完成，不另计一份星星')
      if (!isDayKey(date) || date > todayKey()) throw new Error('日期无效，不能提前打卡')
      if (!pactIsActive(old, await listSignatures(old.childId))) throw new Error('等大家签订后，就能一起打卡')
      if (!old.clauses[clause] || old.clauses[clause].memberId !== actorId) throw new Error('先完成自己的约定，再鼓励家人吧')
      const checkId = `family-check:${id}:${clause}:${date}`
      const existing = await database.familyChecks.get(checkId)
      if (existing) return existing
      return write('familyChecks', { id: checkId, childId: old.childId, pactId: id, clause, memberId: actorId, date, ...stamp() })
    })
  }
  async function encourage(checkId: string, actorId: string) {
    return transact(async () => {
      const check = await database.familyChecks.get(checkId)
      if (!check || check.deleted) throw new Error('这条打卡还没有完成')
      await member(check.childId, actorId)
      if (check.memberId === actorId) throw new Error('把鼓励送给家人吧')
      const id = `encourage:${checkId}:${actorId}`
      if (!await database.familyReactions.get(id)) await write('familyReactions', { id, childId: check.childId, checkId, memberId: actorId, ...stamp() })
    })
  }
  async function archivePact(id: string, actorId: string) {
    return transact(async () => {
      const old = await pact(id); await member(old.childId, actorId, true)
      await write('growthPacts', { ...old, archived: true, updatedAt: nowISO() })
    })
  }
  return { ensureMembers, listMembers, listPacts, listSignatures, listChecks, listReactions, addMember, renameMember, createPact, createWishPact, updateWishPact, updateDraft, sealPact, signPact, checkIn, encourage, archivePact }
}
export const familyRepo = createFamilyRepo(db)
