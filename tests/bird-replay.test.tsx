import {beforeEach,expect,it,vi} from 'vitest'
import {render,screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../src/App'
import {repo} from '../src/db/repo'
vi.mock('../src/components/ParkScene',()=>({default:({interactionId,onInteract}:{interactionId:number;onInteract:()=>void})=><button type="button" onClick={onInteract}>互动序号 {interactionId}</button>}))
beforeEach(async()=>{await repo.clearAll();await repo.createProfile({name:'全全'});window.location.hash='#/child/buddy'})
it('同一动作期间连续点击和键盘激活都会传递新的互动序号',async()=>{
 const user=userEvent.setup();render(<App/>);
 const bird=await screen.findByRole('button',{name:'互动序号 0'})
 await user.click(bird);expect(bird).toHaveTextContent('互动序号 1')
 await user.click(bird);expect(bird).toHaveTextContent('互动序号 2')
 bird.focus();await user.keyboard('{Enter}');expect(bird).toHaveTextContent('互动序号 3')
})
