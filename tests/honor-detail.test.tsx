import { afterEach,it,expect,vi } from 'vitest'
import { render,screen,fireEvent,cleanup,within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HonorDetail } from '../src/components/HonorDetail'
import { ConstellationMap } from '../src/components/ConstellationMap'
import type { ChildProfile } from '../src/db/types'
const profile:ChildProfile={id:'c',name:'孩子',isPrimary:true,createdAt:'',updatedAt:'',honorClaims:{'honor:sport:1':'2026-10-20T10:00:00Z'}}
afterEach(()=>{cleanup();vi.restoreAllMocks()})
it('勋章详情展示条件与获得时间，可直接跳到对应星点；关闭恢复焦点',async()=>{
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.setAttribute('open','')}})
 Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(this:HTMLDialogElement){this.removeAttribute('open');fireEvent(this,new Event('close'))}})
 const trigger=document.createElement('button');document.body.append(trigger);const close=vi.fn()
 render(<HonorDetail honorId="honor:sport:1" profile={profile} trigger={trigger} onClose={close}/> )
 const dialog=screen.getByRole('dialog',{name:'活力小健将 · 1阶'})
 expect(within(dialog).getByText('完成1次运动打卡')).toBeVisible()
 expect(dialog.querySelector('time')).toHaveAttribute('datetime','2026-10-20T10:00:00Z')
 expect(within(dialog).getByRole('link',{name:/去点亮金牛座/})).toHaveAttribute('href','#/child/growth?star=sky%3Ataurus%3A0')
 await userEvent.click(within(dialog).getByRole('button',{name:'收好勋章'}));expect(close).toHaveBeenCalled();expect(trigger).toHaveFocus();trigger.remove()
})
it('从勋章指定的深链接定位准确星座与星点，不自动领取奖励',async()=>{
 render(<ConstellationMap childId="c" profile={profile} focusStarId="sky:taurus:0"/> )
 expect(await screen.findByRole('button',{name:'金牛座第1颗星，可以点亮'})).toHaveAttribute('aria-pressed','true')
 expect(screen.getByRole('button',{name:'点亮金牛座第1颗星 · 获得2星'})).toBeEnabled()
 expect(profile.starClaims).toBeUndefined()
})
