import { it, expect } from 'vitest'
import { evaluateHonors, buildHonorSky } from '../src/lib/honors'
import type { RoutineCheck, RoutineRule } from '../src/db/types'
const rules=[{id:'r',childId:'c',category:'sport'}] as RoutineRule[]
const checks=[{id:'1',childId:'c',ruleId:'r',date:'2026-10-20',status:'done'}] as RoutineCheck[]
it('分类授勋：运动不误算生活，重复、未来及其他孩子不计',()=>{
 const honors=evaluateHonors('c',[],[...checks,...checks,{...checks[0],childId:'other'},{...checks[0],date:'2099-01-01'}],[],null,rules)
 expect(honors.find(h=>h.id==='honor:sport:1')?.eligible).toBe(true)
 expect(honors.find(h=>h.id==='honor:life:1')?.eligible).toBe(false)
 expect(honors.find(h=>h.id==='honor:sport:3')?.value).toBe(1)
})
it('隐藏星星由已获得的勋章显现，点亮与授勋分开，旧版点亮保留',()=>{
 const hidden=buildHonorSky({},{});expect(hidden).toHaveLength(60);expect(hidden.every(s=>!s.revealed)).toBe(true)
 const sky=buildHonorSky({'honor:sport:1':'2026-10-20T00:00:00Z'},{aries:'2026-10-20T00:00:00Z'})
 expect(sky.find(s=>s.id==='sky:taurus:0')).toMatchObject({revealed:true,lit:false})
 expect(sky.find(s=>s.id==='sky:aries:0')).toMatchObject({revealed:true,lit:true})
})
it('美味、宝石和家园装饰按真实冒险结果授勋，不重复抽取，不跨孩子累计',()=>{
 const runs=[
  {date:'2026-10-17',route:'meadow',scene:0},
  {date:'2026-10-18',route:'meadow',scene:1},
  {date:'2026-10-19',route:'forest',scene:1},
 ].map(r=>({...r,id:`adventure:c:${r.date}`,childId:'c',material:'leaf',bonusStars:2,createdAt:'',updatedAt:''})) as import('../src/db/types').AdventureRun[]
 const h=evaluateHonors('c',[],[],[...runs,runs[0]],{date:'2026-10-20',completed:[],xp:4,sleepingSince:null},[])
 for(const id of ['honor:food:1','honor:gem:1','honor:decor:1','honor:care:4','honor:routes:2'])expect(h.find(b=>b.id===id)?.eligible,id).toBe(true)
 expect(h.find(b=>b.id==='honor:adventures:3')?.value).toBe(3)
 expect(evaluateHonors('other',[],[],runs,null,[]).every(h=>!h.eligible)).toBe(true)
})
