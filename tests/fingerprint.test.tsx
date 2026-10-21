import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { FingerprintSign } from '../src/components/FingerprintSign'
afterEach(() => { cleanup(); vi.useRealTimers() })
function setup() {
 vi.useFakeTimers(); const save = vi.fn().mockResolvedValue(undefined)
 const view = render(<FingerprintSign name="小满" onComplete={save} />)
 return { save, button:screen.getByRole('button',{name:'小满按指纹，长按1秒签订公约'}), ...view }
}
describe('指纹长按签订',()=>{
 it('短按松开、移出、取消、失焦均不签订',async()=>{
  const {button,save}=setup()
  for (const event of ['keyUp','blur'] as const) {
   fireEvent.keyDown(button,{key:'Enter'}); act(()=>vi.advanceTimersByTime(500))
   if(event==='keyUp') fireEvent.keyUp(button,{key:'Enter'}); else fireEvent.blur(button)
   act(()=>vi.advanceTimersByTime(1100)); expect(save).not.toHaveBeenCalled()
  }
  fireEvent.click(button); expect(save).not.toHaveBeenCalled()
 })
 it('触屏或鼠标短按、移出和取消不会盖章，按满一秒才提交',async()=>{
  const {button,save}=setup()
  const pointer=(type:string)=>fireEvent(button,Object.assign(new Event(type,{bubbles:true}),{button:0}))
  for(const end of ['pointerup','pointerout','pointercancel']) {
   pointer('pointerdown');act(()=>vi.advanceTimersByTime(500));pointer(end)
   act(()=>vi.advanceTimersByTime(1100));expect(save).not.toHaveBeenCalled()
  }
  pointer('pointerdown');await act(async()=>{vi.advanceTimersByTime(1000)});pointer('pointerup')
  expect(save).toHaveBeenCalledTimes(1)
 })
 it('长按只提交一次；重复按键不会触发第二次',async()=>{
  const {button,save}=setup()
  fireEvent.keyDown(button,{key:' '}); fireEvent.keyDown(button,{key:' ',repeat:true})
  await act(async()=>{vi.advanceTimersByTime(1000)})
  expect(save).toHaveBeenCalledTimes(1)
  act(()=>vi.advanceTimersByTime(3000)); fireEvent.keyUp(button,{key:' '})
  expect(save).toHaveBeenCalledTimes(1)
 })
 it('禁用、卸载和取消后不会残留签订；提供普通确认替代',async()=>{
  const {button,save,rerender,unmount}=setup()
  fireEvent.keyDown(button,{key:'Enter'})
  rerender(<FingerprintSign name="小满" disabled onComplete={save}/>); act(()=>vi.advanceTimersByTime(1200)); expect(save).not.toHaveBeenCalled()
  rerender(<FingerprintSign name="小满" onComplete={save}/>); fireEvent.keyDown(button,{key:'Enter'}); unmount(); act(()=>vi.advanceTimersByTime(1200)); expect(save).not.toHaveBeenCalled()
  render(<FingerprintSign name="小满" onComplete={save}/>)
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'我已读懂，确认签订',hidden:true}))})
  expect(save).toHaveBeenCalledTimes(1)
 })
})
