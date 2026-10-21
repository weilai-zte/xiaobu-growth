import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../src/App'
import { repo } from '../src/db/repo'
import { familyRepo } from '../src/lib/family'
import { SETTINGS_KEYS } from '../src/lib/settings'
import { todayKey } from '../src/lib/date'
import { starBalance } from '../src/lib/rewards'
beforeEach(async()=>{await repo.clearAll();vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{})})
afterEach(cleanup)
describe('一次签约、日常打卡、商店兑换',()=>{
 it('签好的公约持续有效，创建两件奖励不再建公约或要求重签',async()=>{
  const profile=await repo.createProfile({name:'小满'})
  await repo.ensureHabitPlan(profile.id)
  const [parent,child]=await familyRepo.ensureMembers(profile.id)
  const pact=await familyRepo.createPact(profile.id,parent.id,'我们一起成长',[{memberId:child.id,text:'认真完成打卡'},{memberId:parent.id,text:'陪伴和兑现奖励'}])
  await familyRepo.sealPact(pact.id,parent.id);await familyRepo.signPact(pact.id,parent.id);await familyRepo.signPact(pact.id,child.id)
  const signatures=await familyRepo.listSignatures(profile.id), rules=await repo.listRules(profile.id)
  await repo.setSetting(SETTINGS_KEYS.childView,true);window.location.hash='#/child/progress'
  const user=userEvent.setup();render(<App/>)
  await user.click(await screen.findByText('许一个新心愿'))
  for(const name of ['积木奖励','绘本奖励']) {
   await user.type(screen.getByRole('textbox',{name:'我想要…'}),name)
   await user.click(screen.getByRole('button',{name:'放进心愿小屋'}))
   await within(await screen.findByRole('table',{name:'心愿奖励列表'})).findByRole('rowheader',{name:new RegExp(name)})
   await waitFor(()=>expect(screen.getByRole('button',{name:'放进心愿小屋'})).toBeEnabled())
   expect(screen.getByRole('textbox',{name:'我想要…'})).toHaveValue('')
  }
  expect(await familyRepo.listSignatures(profile.id)).toEqual(signatures)
  expect(await familyRepo.listPacts(profile.id)).toHaveLength(1)
  expect(await repo.listRules(profile.id)).toEqual(rules)
  expect(screen.queryByText('选打卡，一起定公约')).not.toBeInTheDocument()
  expect(screen.queryByRole('button',{name:/长按1秒签订公约/})).not.toBeInTheDocument()
  const rule=rules.find(r=>r.habitKey==='body')!
  await repo.setCheck(profile.id,rule.id,todayKey(),'done',null,{stepsDone:rule.steps})
  expect(starBalance([],await repo.listChecks(profile.id),await repo.listWishes(profile.id),[]).earned).toBe(1)
  expect(await familyRepo.listSignatures(profile.id)).toEqual(signatures)
 })
 it('大量礼物保持一行一件；已兑换奖励另表保留',async()=>{
  const profile=await repo.createProfile({name:'小满'})
  for(let i=1;i<=16;i++) {const w=await repo.proposeWish(profile.id,`礼物${i}`,'gift');await repo.changeWish(w.id,'approve',i)}
  await repo.setSetting(SETTINGS_KEYS.childView,true);window.location.hash='#/child/progress';render(<App/>)
  const table=await screen.findByRole('table',{name:'心愿奖励列表'})
  await within(table).findByRole('rowheader',{name:/礼物16/})
  expect(within(table).getAllByRole('row')).toHaveLength(17)
  expect(within(table).getAllByRole('columnheader').map(e=>e.textContent)).toEqual(['礼物','星星','状态','操作'])
  expect(document.querySelector('.wish-grid')).toBeNull()
  expect(screen.queryByText('选打卡，一起定公约')).not.toBeInTheDocument()
 })
})
