import {beforeEach,expect,it} from 'vitest'
import {repo} from '../src/db/repo'
import {familyRepo,pactIsActive} from '../src/lib/family'
import {starBalance} from '../src/lib/rewards'
import {todayKey} from '../src/lib/date'
beforeEach(()=>repo.clearAll())
it('签约后追加独立礼物，打卡只计一次，兑换预留和兑现闭环不改动公约与签名',async()=>{
 const p=await repo.createProfile({name:'正式使用验收'});await repo.ensureHabitPlan(p.id)
 const [parent,child]=await familyRepo.ensureMembers(p.id),rules=await repo.listRules(p.id)
 const pact=await familyRepo.createPact(p.id,parent.id,'我们的攒星星公约',[{memberId:parent.id,text:'陪伴打卡，按商店星数兑现奖励'},{memberId:child.id,text:'认真完成每日习惯，不重复领星'}],undefined,rules.map(r=>r.id))
 await familyRepo.sealPact(pact.id,parent.id);await familyRepo.signPact(pact.id,parent.id);await familyRepo.signPact(pact.id,child.id)
 const before=await familyRepo.listPacts(p.id),signatures=await familyRepo.listSignatures(p.id)
 expect(pactIsActive(before[0],signatures)).toBe(true)
 const gift=await repo.proposeWish(p.id,'一起做饼干','gift',1)
 await repo.proposeWish(p.id,'后续追加的绘本','book',10)
 const rule=rules.find(r=>r.habitKey==='body')!
 await repo.setCheck(p.id,rule.id,todayKey(),'done',null,{stepsDone:rule.steps})
 await repo.setCheck(p.id,rule.id,todayKey(),'done',null,{stepsDone:rule.steps})
 const balance=async()=>starBalance([],await repo.listChecks(p.id),await repo.listWishes(p.id))
 expect((await balance()).available).toBe(1)
 await repo.changeWish(gift.id,'request');expect((await balance()).reserved).toBe(1);expect((await balance()).available).toBe(0)
 await repo.changeWish(gift.id,'cancel');expect((await balance()).available).toBe(1)
 await repo.changeWish(gift.id,'request');await repo.changeWish(gift.id,'redeem')
 expect((await balance()).spent).toBe(1);expect((await balance()).reserved).toBe(0)
 expect(await familyRepo.listPacts(p.id)).toEqual(before);expect(await familyRepo.listSignatures(p.id)).toEqual(signatures)
 expect((await repo.listWishes(p.id)).find(w=>w.id===gift.id)?.status).toBe('redeemed')
})
