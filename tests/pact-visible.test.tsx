import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {render,screen,cleanup} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../src/App'
import {repo} from '../src/db/repo'
import {familyRepo} from '../src/lib/family'
beforeEach(async()=>{await repo.clearAll();vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{})})
afterEach(cleanup)
async function setup(){const p=await repo.createProfile({name:'小满'}),[parent,child]=await familyRepo.ensureMembers(p.id);const pact=await familyRepo.createPact(p.id,parent.id,'一起读书',[{memberId:child.id,text:'收好书'},{memberId:parent.id,text:'陪孩子读书'}]);await familyRepo.sealPact(pact.id,parent.id);await familyRepo.signPact(pact.id,parent.id);return{p,parent,child,pact}}
it('儿童首页移出公约管理，但旧公约和签名在家长端完整保留',async()=>{
 const {p,pact}=await setup(),before=await familyRepo.listPacts(p.id),signs=await familyRepo.listSignatures(p.id)
  window.location.hash='#/child';const user=userEvent.setup();render(<App/>);await screen.findByRole('heading',{name:'每日打卡'})
 expect(screen.queryByRole('region',{name:'我们的成长公约'})).not.toBeInTheDocument()
 await user.click(screen.getByRole('link',{name:'家长'}));await user.click(await screen.findByRole('button',{name:'进入家长模式'}));await user.click(await screen.findByRole('link',{name:/家庭与公约/}))
 expect(await screen.findByRole('heading',{name:pact.title})).toBeVisible()
 expect(await familyRepo.listPacts(p.id)).toEqual(before);expect(await familyRepo.listSignatures(p.id)).toEqual(signs)
})
it('修改公约生成新版本，全员签好才替代旧版，旧签名不清空',async()=>{
 const {p,parent,child,pact}=await setup();await familyRepo.signPact(pact.id,child.id)
 const next=await familyRepo.createPact(p.id,parent.id,'新读书约定',pact.clauses,pact.id)
 await familyRepo.sealPact(next.id,parent.id);await familyRepo.signPact(next.id,parent.id)
 expect((await familyRepo.listPacts(p.id)).find(x=>x.id===pact.id)?.archived).toBe(false)
 await familyRepo.signPact(next.id,child.id)
 expect((await familyRepo.listPacts(p.id)).find(x=>x.id===pact.id)?.archived).toBe(true)
 expect((await familyRepo.listSignatures(p.id)).filter(x=>x.pactId===pact.id)).toHaveLength(2)
})
it('家长页面刷新重新锁定，儿童默认入口不受旧模式设置影响',async()=>{
 await repo.createProfile({name:'小满'});await repo.setSetting('ui.childView',false)
 window.location.hash='#/parent';const user=userEvent.setup();const view=render(<App/>);await user.click(await screen.findByRole('button',{name:'进入家长模式'}));await screen.findByRole('heading',{name:'家长管理'})
 view.unmount();render(<App/>);expect(await screen.findByRole('heading',{name:'这部分需要家长查看'})).toBeVisible()
  cleanup();window.location.hash='#/';render(<App/>);expect(await screen.findByRole('heading',{name:'每日打卡'})).toBeVisible()
})
