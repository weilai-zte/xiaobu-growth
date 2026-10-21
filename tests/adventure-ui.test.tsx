import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GrowthDB } from '../src/db/db'
import { createRepo, newId } from '../src/db/repo'
import { createSyncEngine } from '../src/db/sync'
import { SyncProvider } from '../src/app/SyncProvider'
import { Adventure } from '../src/components/Adventure'
import { BuddyBird, BirdGrowth } from '../src/components/GrowthJourney'
import { adventureDay } from '../src/lib/adventure'
import { buildExportBundle, importBundle, rowsToCsv } from '../src/lib/transfer'
import type { RoutineCheck } from '../src/db/types'

let database: GrowthDB
beforeEach(() => { database = new GrowthDB(`adventure-ui-${newId()}`); vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(); vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {}) })
afterEach(async () => { await database.delete() })

describe('冒险图卡', () => {
  it('未达标先说明准备方式，选路线失败可重试，保存成功才揭晓奖励', async () => {
    const repo = createRepo(database)
    const date = adventureDay()
    const row = { id: `adventure:child:${date}`, childId: 'child', date, route: 'forest', scene: 1, material: 'leaf', bonusStars: 5, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    let fail = true
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).endsWith('/adventure')) return new Response(JSON.stringify(fail ? { error: '这次没有连上，请重试' } : { adventure: row }), { status: fail ? 503 : 200 })
      return new Response(JSON.stringify({ seq: 0, tables: {} }))
    })
    const engine = createSyncEngine({ repo, endpoint: '/fake', fetchImpl, intervalMs: 600000 })
    const user = userEvent.setup()
    const props = { childId: 'child', date, tasks: [], checks: [], runs: [] }
    const view = render(<SyncProvider engine={engine}><Adventure {...props} /></SyncProvider>)
    const prepare = screen.getByRole('button', { name: '还差 5 星，看看怎么准备' })
    await user.click(prepare)
    expect(screen.getByText(/还差 5 颗星/)).toBeInTheDocument()
    expect(screen.getByText(/蜂蜜点心 · 彩虹贝壳 · 闪亮宝石/)).toBeInTheDocument()
    const checks = ['a', 'b', 'c'].map(ruleId => ({ ruleId, date, status: 'done' })) as RoutineCheck[]
    view.rerender(<SyncProvider engine={engine}><Adventure {...props} checks={checks} /></SyncProvider>)
    await user.click(screen.getByRole('button', { name: '出发冒险' }))
    await user.click(screen.getByRole('button', { name: /^小树林/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('这次没有连上')
    expect(await database.adventureRuns.count()).toBe(0)
    fail = false
    await user.click(screen.getByRole('button', { name: /^小树林/ }))
    expect(await screen.findByText('今天的冒险收好啦')).toBeInTheDocument()
    await waitFor(async () => expect(await database.adventureRuns.count()).toBe(1))
    expect(screen.queryByRole('button', { name: '出发冒险' })).not.toBeInTheDocument()
    const bundle = await buildExportBundle(database)
    expect(rowsToCsv(bundle.data.adventureRuns, 'adventureRuns')).toContain('奖励星星')
    await database.adventureRuns.clear()
    await importBundle(database, bundle); await importBundle(database, bundle)
    expect(await database.adventureRuns.count()).toBe(1)
    engine.stop()
  })
  it('蛋、裂壳、出生与家的外观可区分，未到达的阶段不冒充已解锁', () => {
    const view = render(<BuddyBird stage="egg" />)
    expect(screen.getByRole('img', { name: '小步：一颗小蛋' })).toBeInTheDocument()
    view.rerender(<BirdGrowth count={2} />)
    expect(screen.getByRole('heading', { name: '小步出生啦' })).toBeInTheDocument()
    expect(screen.getByText('再一起冒险 3 次，就到「练习飞的小鸟」。')).toBeInTheDocument()
    expect(screen.getByText('温暖的小家', { selector: 'strong' }).closest('li')).not.toHaveClass('reached')
  })
})
