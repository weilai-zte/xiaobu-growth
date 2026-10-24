import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConstellationMap } from '../src/components/ConstellationMap'
import { repo } from '../src/db/repo'
import type { ChildProfile } from '../src/db/types'
const profile:ChildProfile={id:'c',name:'孩子',isPrimary:true,createdAt:'',updatedAt:'',honorClaims:{'honor:sport:1':'2026-10-20T00:00:00Z'}}
beforeEach(()=>{
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.setAttribute('open','')}})
 Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(this:HTMLDialogElement){this.removeAttribute('open');fireEvent(this,new Event('close'))}})
})
afterEach(()=>{cleanup();vi.restoreAllMocks()})
describe('勋章唤醒隐藏星空',()=>{
 it('总览按需打开星轨，关闭后恢复卡片焦点',async()=>{
  render(<ConstellationMap childId="c" profile={profile}/>)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  const tile=screen.getByRole('button',{name:'查看巨蟹座，已点亮0颗，共5颗'})
  await userEvent.click(tile)
  const detail=screen.getByRole('dialog',{name:'巨蟹座 · 星轨详情'})
  expect(within(detail).getByRole('group',{name:/巨蟹座星图/})).toBeVisible()
  const close=within(detail).getByRole('button',{name:'返回星空总览'})
  expect(close).toHaveFocus();await userEvent.keyboard('{Enter}')
  expect(detail).not.toHaveAttribute('open');expect(tile).toHaveFocus()
 })
 it('十二张卡，每张五颗星，未发现时不透露条件',async()=>{
  const user=userEvent.setup();render(<ConstellationMap childId="c" profile={profile}/> )
  expect(screen.getAllByRole('button',{name:/^查看.*座/})).toHaveLength(12)
  expect(screen.queryByRole('group',{name:/白羊座星图/})).not.toBeInTheDocument()
  await user.click(screen.getByRole('button',{name:'查看白羊座，已点亮0颗，共5颗'}))
  expect(screen.getAllByRole('button',{name:/白羊座第.*神秘星影/})).toHaveLength(5)
  expect(screen.queryByText('完成1次生活打卡')).not.toBeInTheDocument()
  if(screen.queryByRole('dialog',{name:/星轨详情/})) await user.click(screen.getByRole('button',{name:'返回星空总览'}))
  await user.click(screen.getByRole('button',{name:'查看金牛座，已点亮0颗，共5颗'}))
  expect(screen.getByRole('button',{name:'金牛座第1颗星，可以点亮'})).toBeVisible()
  expect(screen.getByText('完成1次运动打卡，勋章唤醒了这颗星。')).toBeVisible()
  await user.click(screen.getByRole('button',{name:'金牛座第2颗星，神秘星影'}))
  expect(screen.queryByText('完成3次运动打卡')).not.toBeInTheDocument()
  expect(screen.queryByRole('button',{name:/^点亮金牛座/})).not.toBeInTheDocument()
 })
 it('键盘手动点亮指定星，卡片可打开和关闭并恢复焦点',async()=>{
  const light=vi.spyOn(repo,'lightHonorStar').mockResolvedValue(undefined)
  Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.setAttribute('open','')}})
  Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(this:HTMLDialogElement){this.removeAttribute('open');fireEvent(this,new Event('close'))}})
  const user=userEvent.setup();render(<ConstellationMap childId="c" profile={profile}/>)
  await user.click(screen.getByRole('button',{name:'查看金牛座，已点亮0颗，共5颗'}))
  const button=screen.getByRole('button',{name:'点亮金牛座第1颗星 · 获得2星'});button.focus();await user.keyboard('{Enter}')
  await waitFor(()=>expect(light).toHaveBeenCalledWith('c','sky:taurus:0'))
  const preview=screen.getByRole('button',{name:'欣赏金牛座星卡'});await user.click(preview)
  const dialog=screen.getByRole('dialog',{name:'金牛座 · 星光收藏卡'})
  expect(within(dialog).getByRole('article',{name:'金牛座闪耀收藏卡'})).toBeVisible()
  expect(within(dialog).getByRole('button',{name:'收好卡片'})).toHaveFocus()
  await user.keyboard('{Enter}');expect(dialog).not.toHaveAttribute('open');expect(preview).toHaveFocus()
 })
 it('历史已领取成就映射为第一颗星，打卡撤回不会熄灭',async()=>{
  render(<ConstellationMap childId="c" profile={{...profile,starClaims:{aries:'2026-10-20T00:00:00Z'}}}/>)
  await userEvent.click(screen.getByRole('button',{name:'查看白羊座，已点亮1颗，共5颗'}))
  expect(screen.getByRole('button',{name:'白羊座第1颗星，已点亮'})).toBeVisible()
  expect(screen.getByRole('button',{name:'已经点亮'})).toBeDisabled()
  expect(screen.getByText('已点亮 1 / 60 颗 · 集齐 0 / 12 张')).toBeVisible()
 })
})
it('总览页刷新荣誉失败时，错误直接可见，不藏在未打开的详情中',async()=>{
 vi.spyOn(repo,'refreshHonors').mockRejectedValue(new Error('offline'))
 render(<ConstellationMap childId="c" profile={profile}/>)
 expect(await screen.findByText('荣誉暂未准备好，请稍后重试。')).toBeVisible()
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
