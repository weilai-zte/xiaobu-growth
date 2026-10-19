import { beforeEach, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../src/App'
import { repo } from '../src/db/repo'
import { db } from '../src/db/db'
import { SETTINGS_KEYS } from '../src/lib/settings'
import { birdLoot } from '../src/lib/birdCompanion'
import type { AdventureRun } from '../src/db/types'

beforeEach(async () => { await repo.clearAll(); vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {}) })
it('小鸟可点击互动，已获得物品可换上并保存，未获得物品不可用', async () => {
  const child = await repo.createProfile({ name: '全全' })
  const make = (date: string): AdventureRun => ({ id: `adventure:${child.id}:${date}`, childId: child.id, date, route: 'forest', scene: 2, material: 'leaf', bonusStars: 2, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
  const run = make('2026-10-19')
  await db.adventureRuns.bulkPut([run, make('2026-10-18')])
  await repo.setSetting(SETTINGS_KEYS.childView, true)
  window.location.hash = '#/child/progress'
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: '和虎皮鹦鹉小步互动' }))
  expect(await screen.findByText('全全，啾啾！击个掌，今天也要一起玩！')).toBeInTheDocument()
  const item = birdLoot(run)
  await user.click(screen.getByRole('button', { name: new RegExp(item.name) }))
  await waitFor(async () => expect((await repo.listProfiles())[0].buddyAccessory).toBe(item.key))
  expect(screen.getAllByRole('button').some(b => b.textContent?.includes('冒险中可以发现') && b.hasAttribute('disabled'))).toBe(true)
  await waitFor(() => expect(screen.getByRole('button', { name: '收好装备' })).toBeEnabled())
  await user.click(screen.getByRole('button', { name: '收好装备' }))
  await waitFor(async () => expect((await repo.listProfiles())[0].buddyAccessory).toBeNull())
})
