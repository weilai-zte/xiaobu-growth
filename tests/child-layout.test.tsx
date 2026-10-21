import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../src/App'
import { repo } from '../src/db/repo'
import { SETTINGS_KEYS } from '../src/lib/settings'

beforeEach(async()=>{await repo.clearAll();await repo.createProfile({name:'小满'});await repo.setSetting(SETTINGS_KEYS.childView,true);vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{})})
afterEach(cleanup)
describe('儿童端只保留四个主入口',()=>{
 it('首页直接打卡，家长和家庭设置不占用主导航',async()=>{
  window.location.hash='#/child';render(<App />)
  const nav=await screen.findByRole('navigation',{name:'主导航'})
  expect(within(nav).getAllByRole('link').map(a=>a.textContent?.trim())).toEqual(['每日打卡','梦幻星空','小步乐园','小小心愿'])
  expect(await screen.findByRole('button',{name:/穿好拖鞋和衣裤，查看步骤/})).toBeInTheDocument()
  expect(screen.getByRole('button',{name:/运动打卡/})).toBeInTheDocument()
  expect(screen.getByRole('button',{name:/学习打卡/})).toBeInTheDocument()
  expect(screen.queryByRole('button',{name:'添加家庭成员'})).not.toBeInTheDocument()
  expect(screen.queryByRole('button',{name:'试听鼓励'})).not.toBeInTheDocument()
 })
 it('小步乐园集中放置照料、冒险和百宝箱，首页不再重复',async()=>{
  window.location.hash='#/child/buddy';render(<App />)
  expect(await screen.findByRole('heading',{name:'小步乐园'})).toBeVisible()
  const home=await screen.findByRole('region',{name:'小步的家'})
  expect(await within(home).findByRole('button',{name:/喂食/})).toBeVisible()
  expect(within(home).getByRole('button',{name:/睡一会/})).toBeVisible()
  expect(within(home).getByRole('button',{name:/百宝箱/})).toBeVisible()
  expect(within(home).getByRole('button',{name:/去冒险/})).toBeVisible()
  expect(screen.queryByRole('button',{name:/穿好拖鞋和衣裤，查看步骤/})).not.toBeInTheDocument()
 })
 it('星空页只展示成长，心愿页只展示礼物，旧公约地址回到打卡页展开',async()=>{
  window.location.hash='#/child/growth';const user=userEvent.setup();render(<App />)
  await screen.findByRole('heading',{name:'我的成长星空'})
  expect(screen.queryByRole('textbox',{name:'我想要…'})).not.toBeInTheDocument()
  await user.click(within(screen.getByRole('navigation',{name:'主导航'})).getByRole('link',{name:'小小心愿'}))
  await screen.findByRole('heading',{name:'心愿商店 · 我想要的礼物'})
  expect(screen.queryByRole('heading',{name:'我的成长星空'})).not.toBeInTheDocument()
  expect(screen.getByRole('textbox',{name:'我想要…'})).not.toBeVisible()
 })
 it('旧公约链接进入家长门锁，不再展开儿童首页的管理内容',async()=>{
  window.location.hash='#/child/family';render(<App />)
  expect(await screen.findByRole('heading',{name:'这部分需要家长查看'})).toBeVisible()
  expect(screen.queryByRole('button',{name:'添加家庭成员'})).not.toBeInTheDocument()
 })
})
