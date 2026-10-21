import { afterEach, beforeEach, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../src/App'
import { db } from '../src/db/db'
import { repo } from '../src/db/repo'
import { SETTINGS_KEYS } from '../src/lib/settings'

beforeEach(async () => {
  await repo.clearAll()
  await repo.createProfile({ name: '小满' })
  await repo.setSetting(SETTINGS_KEYS.childView, true)
  window.location.hash = '#/child/buddy'
})

afterEach(cleanup)

it('照料首次加分、重复互动不加分，睡觉会保存且叫醒后恢复冒险', async () => {
  const user = userEvent.setup()
  const firstRender = render(<App />)
  expect(await screen.findByRole('heading', { name: '小步乐园' })).toBeVisible()
  const home = await screen.findByRole('region', { name: '小步的家' })
  const child = (await repo.listProfiles())[0]

  const feed = await within(home).findByRole('button', { name: /喂食/ })
  await user.click(feed)
  await waitFor(async () => {
    expect((await db.childProfiles.get(child.id))?.buddyCare).toMatchObject({
      completed: ['feed'],
      xp: 1,
      sleepingSince: null,
    })
  })
  await waitFor(() => expect(feed).toBeEnabled())
  const beforeRepeat = (await db.childProfiles.get(child.id))!.updatedAt
  await user.click(feed)
  await waitFor(async () => {
    const saved = await db.childProfiles.get(child.id)
    expect(saved?.updatedAt).not.toBe(beforeRepeat)
    expect(saved?.buddyCare).toMatchObject({ completed: ['feed'], xp: 1 })
  })

  const sleep = within(home).getByRole('button', { name: /睡一会/ })
  await waitFor(() => expect(sleep).toBeEnabled())
  await user.click(sleep)
  await waitFor(async () => {
    expect((await db.childProfiles.get(child.id))?.buddyCare?.sleepingSince).toBeTruthy()
  })
  await waitFor(() => {
    const blockedWhileSleeping = within(home).getAllByRole('button').filter(button => button.textContent?.includes('先叫醒小步'))
    expect(blockedWhileSleeping.length).toBeGreaterThanOrEqual(4)
    expect(blockedWhileSleeping.every(button => (button as HTMLButtonElement).disabled)).toBe(true)
  })

  firstRender.unmount()
  render(<App />)
  const restoredHome = await screen.findByRole('region', { name: '小步的家' })
  expect(within(restoredHome).getByRole('button', { name: /^叫醒小步/ })).toBeEnabled()
  const restoredBlocked = within(restoredHome).getAllByRole('button').filter(button => button.textContent?.includes('先叫醒小步'))
  expect(restoredBlocked.every(button => (button as HTMLButtonElement).disabled)).toBe(true)

  await user.click(within(restoredHome).getByRole('button', { name: /^叫醒小步/ }))
  await waitFor(async () => {
    expect((await db.childProfiles.get(child.id))?.buddyCare?.sleepingSince).toBeNull()
  })
  await waitFor(() => expect(within(restoredHome).getByRole('button', { name: /去冒险/ })).toBeEnabled())
})
