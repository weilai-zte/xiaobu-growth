import { it, expect } from 'vitest'
import { GrowthDB } from '../src/db/db'
import { createRepo,newId } from '../src/db/repo'
import { achievementBonus } from '../src/lib/starAchievements'
it('自动授勋不加奖励；独立手动点亮、重复领取、刷新和兑换闭环',async()=>{
 const db=new GrowthDB(`honors-${newId()}`)
 try {
 const r=createRepo(db),p=await r.createProfile({name:'孩子'})
 await expect(r.lightHonorStar(p.id,'sky:taurus:0')).rejects.toThrow('没有被勋章')
 await db.routineRules.put({id:'r',childId:p.id,category:'sport',builtinKey:null,title:'跳绳',steps:[],trigger:'anytime',active:true,order:0,createdAt:'',updatedAt:''})
 await db.routineChecks.put({id:'check',childId:p.id,ruleId:'r',date:'2026-10-20',status:'done',createdAt:'',updatedAt:'',rewardStars:2})
 await r.refreshHonors(p.id)
 let saved=await db.childProfiles.get(p.id)
 expect(saved?.honorClaims?.['honor:sport:1']).toBeTruthy()
 expect(achievementBonus(saved?.starClaims)).toBe(0)
 expect(await r.refreshHonors(p.id)).toEqual([])
 await Promise.all([r.lightHonorStar(p.id,'sky:taurus:0'),r.lightHonorStar(p.id,'sky:taurus:0')])
 saved=await db.childProfiles.get(p.id);expect(achievementBonus(saved?.starClaims)).toBe(2)
 const wish=await r.proposeWish(p.id,'礼物','gift',4);await r.changeWish(wish.id,'request');await r.changeWish(wish.id,'redeem')
 await db.routineChecks.delete('check');await r.refreshHonors(p.id)
 await db.close();await db.open()
 expect((await db.childProfiles.get(p.id))?.honorClaims?.['honor:sport:1']).toBeTruthy()
 expect(achievementBonus((await db.childProfiles.get(p.id))?.starClaims)).toBe(2)
 }finally{await db.delete()}
})
it('旧星座的第一颗星保留，不能再次领取，其他新星可继续收集',()=>{
 expect(achievementBonus({aries:'2026-10-20T00:00:00Z','sky:aries:0':'2026-10-20T00:00:00Z'})).toBe(2)
 expect(achievementBonus({aries:'2026-10-20T00:00:00Z','sky:aries:1':'2026-10-20T00:00:00Z'})).toBe(4)
})
it('照料、授勋和档案设置同时发生不会互相覆盖收藏',async()=>{
 const db=new GrowthDB(`honor-race-${newId()}`)
 try {
 const r=createRepo(db),p=await r.createProfile({name:'孩子'})
 await db.childProfiles.update(p.id,{honorClaims:{'honor:total:1':'2026-10-20T00:00:00Z'}})
 await Promise.all([r.recordBuddyCare(p.id,'feed','2026-10-20T10:00:00Z'),r.lightHonorStar(p.id,'sky:cancer:0'),r.updateProfile(p.id,{nickname:'小满'})])
 const saved=await db.childProfiles.get(p.id)
 expect(saved?.starClaims?.['sky:cancer:0']).toBeTruthy()
 expect(saved?.buddyCare?.xp).toBe(1)
 expect(saved?.nickname).toBe('小满')
 }finally{await db.delete()}
})
