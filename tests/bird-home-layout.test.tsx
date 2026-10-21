import {beforeEach,expect,it,vi} from 'vitest'
import {render,screen,within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../src/App'
import {repo} from '../src/db/repo'
beforeEach(async()=>{await repo.clearAll();await repo.createProfile({name:'小满'});window.location.hash='#/child/buddy';vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{})})
it('百宝箱和冒险只在独立的小步乐园内按需展开',async()=>{
 const user=userEvent.setup();render(<App/>);const home=await screen.findByRole('region',{name:'小步的家'})
 const gear=within(home).getByRole('button',{name:/百宝箱/}),adventure=await within(home).findByRole('button',{name:/去冒险/})
 expect(gear).toHaveAttribute('aria-expanded','false');expect(adventure).toHaveAttribute('aria-expanded','false')
 await user.click(gear);expect(await within(home).findByRole('region',{name:'小步的玩具和装备'})).toBeVisible()
 await user.click(adventure);expect(gear).toHaveAttribute('aria-expanded','false')
 const prepare=await within(home).findByRole('button',{name:'还差 5 星，看看怎么准备'})
 await user.click(prepare)
 expect(await within(home).findByText(/还差 5 颗星/)).toBeVisible()
 expect(within(home).getByText(/发现后可以摆进小步的家/)).toBeVisible()
 expect(screen.queryByText('我在攒的心愿')).not.toBeInTheDocument()
 expect(document.querySelector('.buddy-stage .bird-items')).toBeNull()
})
