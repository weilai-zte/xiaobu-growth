// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { validateFamilyRecord } from '../server/family.mjs'
const p = { id: 'p', childId: 'c', title: '公约', clauses: [{memberId:'child',text:'收玩具'}, {memberId:'adult',text:'专心陪伴'}], authorId:'adult', sealed:true, archived:false }
const rows: Record<string, Record<string, object>> = { familyMembers: { adult: { id:'adult', childId:'c', name:'家长', role:'parent' }, child: { id:'child',childId:'c',name:'孩子',role:'child' } }, growthPacts: {p}, pactSignatures: { a: {pactId:'p',memberId:'adult'}, c: {pactId:'p',memberId:'child'} }, familyChecks: { 'family-check:p:0:2026-10-20': {childId:'c',memberId:'child'} } }
const get = (e: string,id: string) => rows[e]?.[id]
const list = (e: string) => Object.values(rows[e] ?? {})
const validate = (e: string,r: object,old?: object) => validateFamilyRecord(e,r,old,get,list)
describe('同步端家庭记录完整性', () => {
  it('已签订的内容不可悄悄修改', () => { expect(() => validate('growthPacts',{...p,title:'新标题'},p)).toThrow('重新') })
  it('有效签订和打卡允许同步，畸形日期与冒名条目拒绝', () => {
    expect(() => validate('pactSignatures',{id:'signature:p:child',childId:'c',pactId:'p',memberId:'child'})).not.toThrow()
    expect(() => validate('familyChecks',{id:'family-check:p:0:2026-10-20',childId:'c',pactId:'p',memberId:'child',clause:0,date:'2026-10-20'})).not.toThrow()
    expect(() => validate('familyChecks',{id:'bad',childId:'c',pactId:'p',memberId:'adult',clause:0,date:'2026-02-30'})).toThrow()
    expect(() => validate('pactSignatures',{id:'duplicate',childId:'c',pactId:'p',memberId:'child'})).toThrow()
  })
  it('自己给自己点赞、跨家庭和删除签订记录均拒绝', () => {
    expect(() => validate('familyReactions',{id:'x',childId:'c',checkId:'family-check:p:0:2026-10-20',memberId:'child'})).toThrow()
    expect(() => validate('pactSignatures',{id:'x',childId:'other',memberId:'child',pactId:'p'})).toThrow()
    expect(() => validate('pactSignatures',{id:'x',deleted:true})).toThrow()
  })
})

describe('同步端心愿公约校验',()=>{
 const wishPlan = {wishId:'w',ruleIds:['r'],rewardName:'积木',rewardCost:10}
 const wish = {childId:'c',name:'积木',cost:10}
 const lookup = (e:string,id:string) => e==='wishes'&&id==='w' ? wish : e==='routineRules'&&id==='r' ? {childId:'c'} : get(e,id)
 const check = (row:object,old?:object) => validateFamilyRecord('growthPacts',row,old,lookup,list)
 it('合法关联可同步，锁定后不可替换奖励或打卡',()=>{
  const row={...p,wishPlan}
  expect(()=>check(row)).not.toThrow()
  expect(()=>check({...row,wishPlan:{...wishPlan,ruleIds:['other']}},row)).toThrow()
  expect(()=>check({...row,wishPlan:undefined},row)).toThrow()
 })
 it('跨孩子、缺少家长或未定价的已签公约拒绝',()=>{
  expect(()=>check({...p,wishPlan:{...wishPlan,wishId:'other'}})).toThrow()
  expect(()=>check({...p,wishPlan,clauses:[p.clauses[0]]})).toThrow('家长')
  expect(()=>check({...p,wishPlan:{...wishPlan,rewardCost:null}})).toThrow()
 })
 it('心愿公约不能额外写入家庭打卡',()=>{
  expect(()=>validateFamilyRecord('familyChecks',{id:'family-check:p:0:2026-10-20',childId:'c',pactId:'p',memberId:'child',clause:0,date:'2026-10-20'},undefined,(e,id)=>e==='growthPacts'?{...p,wishPlan}:get(e,id),list)).toThrow('原有打卡')
 })
})
