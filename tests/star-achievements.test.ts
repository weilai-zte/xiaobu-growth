import { describe, expect, it } from 'vitest'
import { evaluateStars, achievementBonus } from '../src/lib/starAchievements'
import type { RoutineCheck } from '../src/db/types'
const checks = (n: number) => Array.from({length:n},(_,i)=>({id:`r${i}`,childId:'c',date:'2026-10-20',ruleId:`r${i}`,status:'done'})) as RoutineCheck[]
describe('独立星空成就',()=>{
 it('十二颗星独立判断，达标不自动点亮',()=>{
  const stars=evaluateStars('c',[],checks(5),[],null)
  expect(stars).toHaveLength(12)
  expect(stars[0].eligible).toBe(true)
  expect(stars[1].eligible).toBe(true)
  expect(stars[5].eligible).toBe(false)
  expect(stars.every(s=>!s.lit)).toBe(true)
 })
 it('已点亮的纪念保留；奖励只接受已知星并且每颗只计算一次',()=>{
  const claims={aries:'2026-10-20T10:00:00Z',unknown:'2026-10-20T10:00:00Z'}
  expect(evaluateStars('c',[],[],[],null,claims)[0].lit).toBe(true)
  expect(achievementBonus(claims)).toBe(2)
  expect(achievementBonus({aries:'bad'})).toBe(0)
 })
 it('其他孩子、重复记录、未来记录不会提前解锁',()=>{
  const rows=[...checks(1),...checks(1),...checks(5).map(r=>({...r,childId:'other'})),...checks(5).map(r=>({...r,date:'2099-01-01'}))]
  expect(evaluateStars('c',[],rows,[],null)[1].eligible).toBe(false)
 })
})

import { GrowthDB } from '../src/db/db'
import { createRepo, newId } from '../src/db/repo'
import { starBalance } from '../src/lib/rewards'
it('手动点亮持久保存，拒绝未达标，重复领取不加星，奖励可以兑换',async()=>{
 const db=new GrowthDB(`stars-${newId()}`)
 try {
  const repo=createRepo(db),child=await repo.createProfile({name:'测试'})
  await expect(repo.lightStar(child.id,'pisces')).rejects.toThrow('还没有达到')
  await db.routineChecks.put({...checks(1)[0],childId:child.id})
  await Promise.all([repo.lightStar(child.id,'aries'),repo.lightStar(child.id,'aries')])
  const saved=await db.childProfiles.get(child.id)
  expect(achievementBonus(saved?.starClaims)).toBe(2)
  expect(starBalance([],[],[],[],[],saved?.starClaims).available).toBe(2)
  const wish=await repo.proposeWish(child.id,'小礼物','gift',2)
  await repo.changeWish(wish.id,'request');await repo.changeWish(wish.id,'redeem')
  expect((await repo.listWishes(child.id))[0].status).toBe('redeemed')
  await db.close();await db.open()
  expect((await db.childProfiles.get(child.id))?.starClaims?.aries).toBeTruthy()
 } finally {await db.delete()}
})
it('后续同步儿童档案时不会抹掉已点亮成就',async()=>{
 const db=new GrowthDB(`stars-sync-${newId()}`)
 try {
  const repo=createRepo(db),child=await repo.createProfile({name:'测试'})
  await db.childProfiles.update(child.id,{starClaims:{aries:'2026-10-20T00:00:00Z'}})
  await repo.applyRemote('childProfiles',[{...child,name:'新名字',updatedAt:'2099-01-01T00:00:00Z'}])
  expect((await db.childProfiles.get(child.id))?.starClaims?.aries).toBeTruthy()
 }finally{await db.delete()}
})
it('学习、冒险路线和照料条件都独立累计，十二颗星可分别达标',()=>{
 const tasks=Array.from({length:5},(_,i)=>({id:`t${i}`,childId:'c',date:'2026-10-20',templateId:`t${i}`,name:'学习',completion:'independent'})) as import('../src/db/types').TaskRecord[]
 const history=Array.from({length:7},(_,i)=>({...checks(1)[0],id:`d${i}`,date:`2026-10-${10+i}`}))
 const runs=Array.from({length:14},(_,i)=>({id:`adventure:c:2026-10-${String(i+1).padStart(2,'0')}`,childId:'c',date:`2026-10-${String(i+1).padStart(2,'0')}`,route:i%2?'forest':'meadow',material:'leaf',scene:0,bonusStars:2,createdAt:'',updatedAt:''})) as import('../src/db/types').AdventureRun[]
 const stars=evaluateStars('c',tasks,[...checks(10),...history],runs,{date:'2026-10-20',completed:['feed'],xp:10,sleepingSince:null})
 expect(stars.every(s=>s.eligible)).toBe(true)
 expect(stars.every(s=>!s.lit)).toBe(true)
 expect(evaluateStars('c',[],[],runs)[7].eligible).toBe(true)
 expect(evaluateStars('c',[],[],runs)[0].eligible).toBe(false)
})
