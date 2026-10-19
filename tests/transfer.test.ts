import { beforeEach, describe, expect, it } from 'vitest'
import { GrowthDB } from '../src/db/db'
import { createRepo, newId } from '../src/db/repo'
import {
  buildExportBundle,
  bundleToJson,
  importBundle,
  parseBundle,
  rowsToCsv,
  summarizeBundle,
} from '../src/lib/transfer'

let db: GrowthDB
let repo: ReturnType<typeof createRepo>

beforeEach(() => {
  db = new GrowthDB(`transfer-${newId()}`)
  repo = createRepo(db)
})

async function seed() {
  const child = await repo.createProfile({ name: '小满' })
  await repo.saveDailyLog({
    childId: child.id,
    date: '2026-10-16',
    sleepTime: '22:00',
    wakeTime: '06:30',
    nightCough: 'once',
  })
  await repo.createTaskRecord({
    childId: child.id,
    date: '2026-10-16',
    name: '听写',
    subject: '语文',
    difficulty: 'medium',
    startMode: 'independent',
    completion: 'independent',
    barriers: ['distracted'],
    status: 'finished',
  })
  await repo.createStrength({
    childId: child.id,
    date: '2026-10-16',
    category: 'care',
    event: '弟弟摔倒',
    childAction: '扶他起来',
    outcome: '弟弟不哭了',
  })
  return child
}

describe('导出与恢复', () => {
  it('导出 JSON 之后再导入到新的数据库，数据能完整回来', async () => {
    await seed()
    const bundle = await buildExportBundle(db)
    const text = bundleToJson(bundle)

    const target = new GrowthDB(`restore-${newId()}`)
    const targetRepo = createRepo(target)
    const report = await importBundle(target, parseBundle(text), 'merge')

    expect(report.added).toBeGreaterThan(0)
    expect(report.skippedInvalid).toBe(0)
    const profiles = await targetRepo.listProfiles()
    expect(profiles[0].name).toBe('小满')
    const logs = await targetRepo.listDailyLogs(profiles[0].id)
    expect(logs).toHaveLength(1)
    expect(logs[0].sleepTime).toBe('22:00')
    expect(await targetRepo.listTaskRecords(profiles[0].id)).toHaveLength(1)
    expect(await targetRepo.listStrengths(profiles[0].id)).toHaveLength(1)
  })

  it('重复导入同一份备份不会产生重复记录', async () => {
    await seed()
    const bundle = await buildExportBundle(db)
    const report = await importBundle(db, bundle, 'merge')
    expect(report.added).toBe(0)
    expect(report.skippedDuplicate).toBeGreaterThan(0)
    expect((await repo.listProfiles())).toHaveLength(1)
  })

  it('覆盖模式会先清空再导入', async () => {
    const child = await seed()
    const bundle = await buildExportBundle(db)
    await repo.createStrength({
      childId: child.id,
      date: '2026-10-17',
      category: 'solve',
      event: '自己修好了玩具',
      childAction: '找胶带粘上',
      outcome: '又能玩了',
    })
    expect(await repo.listStrengths(child.id)).toHaveLength(2)
    const report = await importBundle(db, bundle, 'replace')
    expect(report.mode).toBe('replace')
    expect(await repo.listStrengths(child.id)).toHaveLength(1)
  })

  it('损坏或不对应的备份文件会被拒绝', () => {
    expect(() => parseBundle('{ not json')).toThrow('这个文件不是有效的 JSON')
    expect(() => parseBundle(JSON.stringify({ app: 'other', version: 1, data: {} }))).toThrow(
      '这不是「小步成长」导出的备份文件',
    )
    expect(() =>
      parseBundle(JSON.stringify({ app: 'xiaobu-growth', version: 99, data: {} })),
    ).toThrow('备份文件版本比当前应用新')
  })

  it('缺少 ID 的记录会被跳过并报告', async () => {
    const child = await repo.createProfile({ name: '小满' })
    const bundle = await buildExportBundle(db)
    bundle.data.strengthMoments = [
      {
        childId: child.id,
        date: '2026-10-16',
        category: 'care',
        event: '弟弟摔倒',
        childAction: '扶他起来',
        outcome: '弟弟不哭了',
      },
    ]
    const report = await importBundle(db, bundle, 'merge')
    expect(report.skippedInvalid).toBe(1)
    expect(report.invalidMessages[0]).toContain('缺少 ID')
  })

  it('CSV 带中文表头、BOM，并且枚举转成中文', async () => {
    const child = await seed()
    const bundle = await buildExportBundle(db)
    const csv = rowsToCsv(bundle.data.dailyLogs, 'dailyLogs')
    expect(csv.startsWith('\ufeff')).toBe(true)
    expect(csv).toContain('入睡时间')
    expect(csv).toContain('1 次')
    const taskCsv = rowsToCsv(bundle.data.taskRecords, 'taskRecords')
    expect(taskCsv).toContain('独立完成')
    expect(taskCsv).toContain('容易分心')
    expect(summarizeBundle(bundle)).toContain('睡眠与身体记录')
    expect(child.name).toBe('小满')
  })

  it('含逗号和换行的备注能被正确转义', () => {
    const csv = rowsToCsv(
      [
        {
          id: 'a',
          date: '2026-10-16',
          sleepTime: '22:00',
          wakeTime: '06:30',
          note: '睡前看了视频,有点兴奋\n第二天早上起不来',
        },
      ],
      'dailyLogs',
    )
    expect(csv).toContain('"睡前看了视频,有点兴奋\n第二天早上起不来"')
  })
})
