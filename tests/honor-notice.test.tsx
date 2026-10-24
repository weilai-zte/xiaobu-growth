import { it, expect, afterEach } from 'vitest'
import { render,screen,cleanup,waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../src/App'
import { repo } from '../src/db/repo'
import { SETTINGS_KEYS } from '../src/lib/settings'
afterEach(cleanup)
it('在每日打卡页面自动授勋并触发合并消息，可标记已读且刷新不重复提醒',async()=>{
 await repo.clearAll();const child=await repo.createProfile({name:'小满'});await repo.setSetting(SETTINGS_KEYS.childView,true)
 await repo.db.routineChecks.put({id:'honor-check',childId:child.id,ruleId:'r',date:'2026-10-20',status:'done',createdAt:'',updatedAt:'',rewardStars:1})
 window.location.hash='#/child';const view=render(<App/>);const user=userEvent.setup()
 expect(await screen.findByRole('link',{name:'去看新荣誉'})).toHaveAttribute('href','#/child/growth?honors=1')
 await waitFor(async()=>expect((await repo.db.childProfiles.get(child.id))?.honorClaims?.['honor:total:1']).toBeTruthy())
 await user.click(screen.getByRole('button',{name:'知道啦'}))
 await waitFor(()=>expect(screen.queryByRole('link',{name:'去看新荣誉'})).not.toBeInTheDocument())
 view.unmount();render(<App/>);await screen.findByRole('heading',{name:'每日打卡'})
 expect(screen.queryByRole('link',{name:'去看新荣誉'})).not.toBeInTheDocument()
})
it('新勋章播放一次惊喜，同一会话刷新未读消息不会重复播放',async()=>{
 await repo.clearAll();const child=await repo.createProfile({name:'小满'});await repo.setSetting(SETTINGS_KEYS.childView,true)
 await repo.db.routineChecks.put({id:'surprise-check',childId:child.id,ruleId:'r',date:'2026-10-20',status:'done',createdAt:'',updatedAt:''})
 window.location.hash='#/child';const first=render(<App/>)
 await screen.findByRole('button',{name:'打开惊喜勋章'})
 await waitFor(()=>expect(document.querySelector('.honor-confetti')).toBeInTheDocument())
 first.unmount();render(<App/>)
 await screen.findByRole('button',{name:'打开惊喜勋章'})
 expect(document.querySelector('.honor-confetti')).not.toBeInTheDocument()
})
it('星空总览的新勋章提示默认收起，展开后仍可查看和标记已读',async()=>{
 await repo.clearAll();const child=await repo.createProfile({name:'小满'});await repo.setSetting(SETTINGS_KEYS.childView,true)
 await repo.db.routineChecks.put({id:'compact-honor-check',childId:child.id,ruleId:'r',date:'2026-10-20',status:'done',createdAt:'',updatedAt:''})
 window.location.hash='#/child/growth';render(<App/>)
 const summary=await screen.findByText(/枚新勋章 · 点开看看/)
 const details=summary.closest('details')!
 expect(details).not.toHaveAttribute('open')
 expect(screen.getByRole('button',{name:'知道啦'})).not.toBeVisible()
 await userEvent.click(summary)
 expect(details).toHaveAttribute('open')
 await userEvent.click(screen.getByRole('button',{name:'知道啦'}))
 await waitFor(()=>expect(screen.queryByText(/枚新勋章 · 点开看看/)).not.toBeInTheDocument())
})
