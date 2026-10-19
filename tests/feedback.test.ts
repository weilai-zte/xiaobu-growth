import { describe, expect, it } from 'vitest'
import {
  containsForbidden,
  ruleStatusFeedback,
  sleepObservation,
  taskFeedback,
  todayFeedback,
} from '../src/lib/feedback'
import type { DailyLog, RoutineRule, TaskRecord } from '../src/db/types'

function task(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: 't1',
    createdAt: '2026-10-16T08:00:00.000Z',
    updatedAt: '2026-10-16T08:00:00.000Z',
    childId: 'c1',
    templateId: null,
    date: '2026-10-16',
    name: '听写第 3 课',
    subject: '语文',
    difficulty: 'medium',
    plannedMinutes: 15,
    startMode: 'independent',
    completion: 'independent',
    barriers: [],
    actualMinutes: 12,
    parentNote: null,
    status: 'finished',
    timer: null,
    childFeeling: null,
    ...overrides,
  }
}

const rule: RoutineRule = {
  id: 'r1',
  createdAt: '2026-10-16T08:00:00.000Z',
  updatedAt: '2026-10-16T08:00:00.000Z',
  childId: 'c1',
  builtinKey: 'screen_deal',
  title: '按约定使用手机和视频',
  steps: ['开始前确认看什么、看多久'],
  trigger: 'screen',
  customTrigger: null,
  active: true,
  order: 0,
}

const log: DailyLog = {
  id: 'd1',
  createdAt: '2026-10-16T08:00:00.000Z',
  updatedAt: '2026-10-16T08:00:00.000Z',
  childId: 'c1',
  date: '2026-10-16',
  sleepTime: '22:10',
  wakeTime: '06:40',
  nightCongestion: 'moderate',
  nightCough: 'several',
  snoring: 'sometimes',
  nightWaking: 'once',
  morningState: 'tired',
  daytimeSleepiness: 'slight',
  note: null,
}

describe('反馈文案', () => {
  it('今日反馈具体、积极，且不含比较、标签和惩罚词', () => {
    const text = todayFeedback({
      profileName: '小满',
      tasks: [task()],
      checks: [
        {
          check: {
            id: 'k1',
            createdAt: '2026-10-16T08:00:00.000Z',
            updatedAt: '2026-10-16T08:00:00.000Z',
            childId: 'c1',
            ruleId: 'r1',
            date: '2026-10-16',
            status: 'done',
            parentNote: null,
          },
          rule,
        },
      ],
      strengths: [],
    })
    expect(text).toContain('小满')
    expect(text).toContain('听写第 3 课')
    expect(containsForbidden(text)).toEqual([])
  })

  it('没有任何记录时给出温和的下一步，不制造压力', () => {
    const text = todayFeedback({ tasks: [], checks: [], strengths: [] })
    expect(text).toContain('今天还没有记录')
    expect(containsForbidden(text)).toEqual([])
  })

  it('任务反馈不评价速度与正确率', () => {
    const text = taskFeedback(task({ completion: 'partial', barriers: ['hard_to_start'] }))
    expect(text).toContain('难以开始')
    expect(text).not.toContain('正确率')
    expect(text).not.toContain('太慢')
    expect(containsForbidden(text)).toEqual([])
  })

  it('睡眠描述只复述事实，不给诊断或用药建议', () => {
    const text = sleepObservation(log)
    expect(text).toContain('8 小时 30 分')
    expect(text).toContain('夜间咳嗽：2-3 次')
    expect(containsForbidden(text)).toEqual([])
  })

  it('规则反馈在没做到时不使用羞辱性措辞', () => {
    const text = ruleStatusFeedback(rule, 'not_done')
    expect(text).toContain('这次没有做')
    expect(containsForbidden(text)).toEqual([])
  })
})
