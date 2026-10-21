import {expect,it,vi} from 'vitest'
import {render,screen,within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ParkScene from '../src/components/ParkScene'
it('照料在场景选择之前；布置默认收起，可展开且保留解锁规则',async()=>{
 const user=userEvent.setup(),interact=vi.fn()
 const {container}=render(<ParkScene stage="hatch" count={2} activity="idle" flapping={false} accessory="" decor="" onInteract={interact} carePanel={<section aria-label="照料"><button>喂食</button></section>}/>)
 const care=screen.getByRole('region',{name:'照料'}),details=container.querySelector('.park-settings')!
 expect(care.compareDocumentPosition(details)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();expect(details).not.toHaveAttribute('open')
 const summary=screen.getByText('布置乐园 · 阳光草地');await user.click(summary);expect(details).toHaveAttribute('open')
 const zones=screen.getByRole('group',{name:'小布的家园区域'});expect(within(zones).getByRole('button',{name:/森林小屋/})).toBeDisabled()
 expect(within(zones).getByRole('button',{name:/阳光草地/})).toBeEnabled()
 await user.click(screen.getByRole('button',{name:'和虎皮鹦鹉小步互动'}));expect(interact).toHaveBeenCalledOnce()
})
