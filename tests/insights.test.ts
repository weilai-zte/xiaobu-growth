import { describe, expect, it } from 'vitest'
import type { DailyLog, TaskRecord } from '../src/db/types'
import {
  buildPeriodCounts,
  buildWeeklySummary,
  factualObservations,
  insufficientDataNotes,
} from '../src/lib/insights'
import { containsForbidden } from '../src/lib/feedback'

function task(date: string, overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: `t-${date}-${overrides.completion ?? 'x'}`,
    createdAt: `${date}T08:00:00.000Z`,
    updatedAt: `${date}T08:00:00.000Z`,
    childId: 'c1',
    templateId: null,
    date,
    name: '听写',
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

function log(date: string, minutes: [string, string]): DailyLog {
  return {
    id: `d-${date}`,
    createdAt: `${date}T08:00:00.000Z`,
    updatedAt: `${date}T08:00:00.000Z`,
    childId: 'c1',
    date,
    sleepTime: minutes[0],
    wakeTime: minutes[1],
    nightCongestion: null,
    nightCough: 'none',
    snoring: null,
    nightWaking: null,
    morningState: 'ok',
    daytimeSleepiness: 'none',
    note: null,
  }
}

const emptyInput = {
  weekStart: '2026-10-12',
  dailyLogs: [],
  taskRecords: [],
  rules: [],
  checks: [],
  conflicts: [],
  strengths: [],
  experiments: [],
}

describe('每周汇总', () => {
  it('没有任何记录时明确说明数据不足，不生成结论', () => {
    const summary = buildWeeklySummary(emptyInput)
    expect(summary.sleep.available).toBe(false)
    expect(summary.tasks.available).toBe(false)
    const notes = insufficientDataNotes(summary)
    expect(notes.length).toBeGreaterThanOrEqual(5)
    const observations = factualObservations(summary)
    expect(observations.join('')).toContain('本周没有')
    expect(observations.join('')).not.toContain('因此')
  })

  it('睡眠记录不足 3 天时不做趋势描述', () => {
    const summary = buildWeeklySummary({
      ...emptyInput,
      dailyLogs: [log('2026-10-12', ['22:10', '06:40'])],
    })
    expect(summary.sleep.loggedDays).toBe(1)
    expect(summary.sleep.available).toBe(false)
    expect(factualObservations(summary).join('')).toContain('不足 3 天')
  })

  it('只统计本周内的记录', () => {
    const summary = buildWeeklySummary({
      ...emptyInput,
      taskRecords: [
        task('2026-10-12'),
        task('2026-10-14', { completion: 'partial', startMode: 'multi_reminder', barriers: ['distracted'] }),
        task('2026-10-19'),
      ],
      dailyLogs: [
        log('2026-10-12', ['22:00', '06:00']),
        log('2026-10-13', ['22:30', '06:30']),
        log('2026-10-14', ['23:00', '07:00']),
      ],
    })
    expect(summary.tasks.total).toBe(2)
    expect(summary.tasks.independentStart).toBe(1)
    expect(summary.tasks.multiReminderStart).toBe(1)
    expect(summary.tasks.partial).toBe(1)
    expect(summary.tasks.barriers[0].label).toBe('容易分心')
    expect(summary.sleep.available).toBe(true)
    expect(summary.sleep.averageSleepMinutes).toBe(480)
  })

  it('事实描述里不出现因果词和评价词', () => {
    const summary = buildWeeklySummary({
      ...emptyInput,
      taskRecords: [task('2026-10-12')],
      dailyLogs: [
        log('2026-10-12', ['22:00', '06:00']),
        log('2026-10-13', ['22:30', '06:30']),
        log('2026-10-14', ['23:00', '07:00']),
      ],
    })
    const text = [...factualObservations(summary), ...insufficientDataNotes(summary)].join('\n')
    for (const word of ['因为', '所以', '导致', '说明孩子', '证明', '进步了', '懒惰']) {
      expect(text).not.toContain(word)
    }
    expect(containsForbidden(text)).toEqual([])
  })

  it('观察期计数用于实验页面', () => {
    const counts = buildPeriodCounts(
      {
        taskRecords: [task('2026-10-12'), task('2026-10-13', { completion: 'partial' })],
        checks: [],
        conflicts: [],
        strengths: [],
        dailyLogs: [log('2026-10-12', ['22:00', '06:00'])],
      },
      '2026-10-12',
      '2026-10-18',
    )
    expect(counts.taskRecords).toBe(2)
    expect(counts.completedTasks).toBe(1)
    expect(counts.partialTasks).toBe(1)
    expect(counts.sleepLoggedDays).toBe(1)
    expect(counts.days).toBe(7)
  })
})
