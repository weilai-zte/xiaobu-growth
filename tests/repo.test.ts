import { beforeEach, describe, expect, it } from 'vitest'
import { GrowthDB } from '../src/db/db'
import { ValidationError, createRepo, newId } from '../src/db/repo'

let db: GrowthDB
let repo: ReturnType<typeof createRepo>

beforeEach(() => {
  db = new GrowthDB(`test-${newId()}`)
  repo = createRepo(db)
})

async function makeChild() {
  return repo.createProfile({ name: '小满' })
}

describe('本地数据仓库', () => {
  it('创建档案时会自动带上内置规则', async () => {
    const child = await makeChild()
    expect(child.isPrimary).toBe(true)
    const rules = await repo.listRules(child.id)
    expect(rules.length).toBeGreaterThanOrEqual(5)
    expect(rules.map((r) => r.title)).toContain('按约定使用手机和视频')
  })

  it('无效应拒绝写入，并给出中文错误', async () => {
    await expect(repo.createProfile({ name: '' })).rejects.toBeInstanceOf(ValidationError)
    const child = await makeChild()
    await expect(
      repo.saveDailyLog({ childId: child.id, date: '2026-13-01', sleepTime: '22:00' }),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('同一天的睡眠记录是覆盖保存，不会产生重复', async () => {
    const child = await makeChild()
    const first = await repo.saveDailyLog({
      childId: child.id,
      date: '2026-10-16',
      sleepTime: '22:00',
      wakeTime: '06:30',
    })
    const second = await repo.saveDailyLog({
      childId: child.id,
      date: '2026-10-16',
      sleepTime: '23:00',
      wakeTime: '07:00',
    })
    expect(second.id).toBe(first.id)
    const logs = await repo.listDailyLogs(child.id)
    expect(logs).toHaveLength(1)
    expect(logs[0].sleepTime).toBe('23:00')
  })

  it('规则执行记录按规则 + 日期唯一，再次记录是更新', async () => {
    const child = await makeChild()
    const [rule] = await repo.listRules(child.id)
    await repo.setCheck(child.id, rule.id, '2026-10-16', 'partial', '卡在第二步')
    await repo.setCheck(child.id, rule.id, '2026-10-16', 'done')
    const checks = await repo.listChecks(child.id, '2026-10-16', '2026-10-16')
    expect(checks).toHaveLength(1)
    expect(checks[0].status).toBe('done')
    expect(checks[0].parentNote).toBe('卡在第二步')
  })

  it('任务记录可以更新完成情况，也能删除', async () => {
    const child = await makeChild()
    const record = await repo.createTaskRecord({
      childId: child.id,
      date: '2026-10-16',
      name: '口算 20 题',
      subject: '数学',
      difficulty: 'medium',
      plannedMinutes: 15,
      status: 'planned',
    })
    const updated = await repo.updateTaskRecord(record.id, {
      startMode: 'one_reminder',
      completion: 'partial',
      barriers: ['hard_to_start'],
      childFeeling: '有点难',
      status: 'finished',
    })
    expect(updated.completion).toBe('partial')
    expect(updated.childFeeling).toBe('有点难')
    await repo.deleteRecord('taskRecords', record.id)
    expect(await repo.listTaskRecords(child.id)).toHaveLength(0)
  })

  it('每周复盘按周唯一', async () => {
    const child = await makeChild()
    await repo.saveWeeklyReview({ childId: child.id, weekStart: '2026-10-12', improvements: '起床更快' })
    await repo.saveWeeklyReview({
      childId: child.id,
      weekStart: '2026-10-12',
      improvements: '起床更快了',
      nextAdjustments: '只改一件事',
    })
    const reviews = await repo.listWeeklyReviews(child.id)
    expect(reviews).toHaveLength(1)
    expect(reviews[0].improvements).toBe('起床更快了')
  })

  it('清空全部数据会连设置一起清掉', async () => {
    const child = await makeChild()
    await repo.createStrength({
      childId: child.id,
      date: '2026-10-16',
      category: 'care',
      event: '弟弟摔倒',
      childAction: '扶他起来',
      outcome: '弟弟不哭了',
    })
    await repo.setSetting('ui.childView', true)
    await repo.clearAll()
    const counts = await repo.countAll()
    expect(Object.values(counts).every((v) => v === 0)).toBe(true)
    expect(await repo.getSetting('ui.childView', false)).toBe(false)
  })
})
