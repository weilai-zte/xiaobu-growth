import {render,screen,within,fireEvent} from '@testing-library/react'
import {expect,it} from 'vitest'
import ParkScene from '../src/components/ParkScene'

const props={stage:'adult',count:9,activity:'idle' as const,flapping:false,accessory:'',decor:'',onInteract:()=>{}}
it('打开乐园时展示最新解锁的家园，仍可手动回到旧区域',()=>{
 render(<ParkScene {...props} stage="pool" count={35}/> )
 const zones=screen.getByRole('group',{name:'小布的家园区域'})
 expect(within(zones).getByRole('button',{name:/星光泳池/})).toHaveAttribute('aria-pressed','true')
 fireEvent.click(within(zones).getByRole('button',{name:/阳光草地/}))
 expect(within(zones).getByRole('button',{name:/阳光草地/})).toHaveAttribute('aria-pressed','true')
})
it('新解锁家园时自动切换，普通重新渲染不覆盖手动选择',()=>{
 const {rerender}=render(<ParkScene {...props}/> )
 rerender(<ParkScene {...props} stage="nest" count={14}/> )
 const zones=screen.getByRole('group',{name:'小布的家园区域'})
 expect(within(zones).getByRole('button',{name:/温暖小窝/})).toHaveAttribute('aria-pressed','true')
 fireEvent.click(within(zones).getByRole('button',{name:/阳光草地/}))
 rerender(<ParkScene {...props} stage="nest" count={15}/> )
 expect(within(zones).getByRole('button',{name:/阳光草地/})).toHaveAttribute('aria-pressed','true')
 rerender(<ParkScene {...props} stage="home" count={21}/> )
 expect(within(zones).getByRole('button',{name:/森林小屋/})).toHaveAttribute('aria-pressed','true')
 rerender(<ParkScene {...props} stage="egg" count={0}/> )
 expect(within(zones).getByRole('button',{name:/阳光草地/})).toHaveAttribute('aria-pressed','true')
})
it.each([[0,'阳光草地'],[14,'温暖小窝'],[21,'森林小屋'],[28,'蝴蝶花园'],[35,'星光泳池']])('累计 %i 次冒险时自动展示 %s', (count,name)=>{
 render(<ParkScene {...props} count={Number(count)}/> )
 expect(within(screen.getByRole('group',{name:'小布的家园区域'})).getByRole('button',{name:new RegExp(String(name))})).toHaveAttribute('aria-pressed','true')
})
it('轻量场景保留互动回应，睡觉时不能切换区域',()=>{
 const {rerender}=render(<ParkScene {...props} count={35} stage="pool"/> )
 expect(screen.getByRole('img',{name:'小布：星光泳池'})).toBeVisible()
 rerender(<ParkScene {...props} count={35} stage="pool" flapping interactionId={1}/> )
 expect(screen.getByText('小布扑扑翅膀，回应你啦。')).toBeVisible()
 rerender(<ParkScene {...props} count={35} stage="pool" activity="sleep"/> )
 for(const button of within(screen.getByRole('group',{name:'小布的家园区域'})).getAllByRole('button')) expect(button).toBeDisabled()
})
