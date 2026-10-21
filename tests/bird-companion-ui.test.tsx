import { beforeEach, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../src/App'
import { repo } from '../src/db/repo'
import { db } from '../src/db/db'
import { SETTINGS_KEYS } from '../src/lib/settings'
import { adventureTreasure, BIRD_ITEMS, birdLoot } from '../src/lib/birdCompanion'
import type { AdventureRun } from '../src/db/types'

beforeEach(async () => { await repo.clearAll(); vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined); vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {}) })
it('小鸟可点击互动，已获得物品可换上并保存，未获得物品不可用', async () => {
  const child = await repo.createProfile({ name: '全全' })
  const make = (date: string, scene: number): AdventureRun => ({ id: `adventure:${child.id}:${date}`, childId: child.id, date, route: 'forest', scene, material: 'leaf', bonusStars: 2, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
  const run = make('2026-10-19', 2)
  const secondRun = make('2026-10-18', 0)
  await db.adventureRuns.bulkPut([run, secondRun])
  await repo.setSetting(SETTINGS_KEYS.childView, true)
  window.location.hash = '#/child/buddy'
  const user = userEvent.setup()
  render(<App />)
  expect(await screen.findByRole('heading', { name: '小步乐园' })).toBeInTheDocument()
  await user.click(await screen.findByRole('button', { name: '和虎皮鹦鹉小步互动' }))
  expect(document.querySelector('.park-world')).toHaveAttribute('data-flapping','true')
  expect(document.querySelector('canvas[data-scene="budgie-3d"]')).toBeInTheDocument()
  expect(screen.queryByRole('button',{name:'开启森林音乐'})).not.toBeInTheDocument()
  expect(await within(screen.getByRole('region',{name:'小步的家'})).findByText('全全，啾啾！击个掌，今天也要一起玩！')).toBeInTheDocument()
  await user.click(screen.getByRole('button',{name:/百宝箱/}))
  const item = birdLoot(run)
  await user.click(screen.getByRole('button', { name: new RegExp(item.name) }))
  await waitFor(async () => expect((await repo.listProfiles())[0].buddyAccessory).toBe(item.key))
  await user.click(screen.getByText('冒险还能发现什么？'))
  const missingItem = BIRD_ITEMS.find(candidate => candidate.key !== birdLoot(run).key && candidate.key !== birdLoot(secondRun).key)!
  expect(screen.getByText(new RegExp(missingItem.name))).toBeVisible()
  expect(screen.queryByRole('button', { name: new RegExp(missingItem.name) })).not.toBeInTheDocument()
  const treasure = adventureTreasure(run)
  const firstDecor = screen.getByRole('button', { name: `把小屋装饰换成${treasure.name}` })
  await waitFor(() => expect(firstDecor).toBeEnabled())
  await user.click(firstDecor)
  await waitFor(async () => expect((await repo.listProfiles())[0].buddyHomeDecor).toBe(treasure.key))
  const otherTreasure = adventureTreasure(secondRun)
  const secondDecor = screen.getByRole('button', { name: `把小屋装饰换成${otherTreasure.name}` })
  await waitFor(() => expect(secondDecor).toBeEnabled())
  await user.click(secondDecor)
  await waitFor(async () => expect((await repo.listProfiles())[0].buddyHomeDecor).toBe(otherTreasure.key))
  await waitFor(() => expect(screen.getByRole('button', { name: '收好装备' })).toBeEnabled())
  await user.click(screen.getByRole('button', { name: '收好装备' }))
  await waitFor(async () => expect((await repo.listProfiles())[0].buddyAccessory).toBeNull())
})
