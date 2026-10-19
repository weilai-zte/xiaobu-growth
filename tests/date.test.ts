import { describe, expect, it } from 'vitest'
import {
  addDays,
  defaultLogDate,
  diffDays,
  eachDay,
  formatDuration,
  isDayKey,
  minutesToClock,
  sleepDurationMinutes,
  startOfWeek,
  toDayKey,
  todayKey,
  weekDates,
  weekLabel,
} from '../src/lib/date'
import { averageClock } from '../src/lib/insights'

describe('日期与时间工具', () => {
  it('用本地时间生成自然日，不受 UTC 偏移影响', () => {
    const early = new Date(2026, 9, 16, 0, 30)
    expect(toDayKey(early)).toBe('2026-10-16')
    const late = new Date(2026, 9, 16, 23, 30)
    expect(toDayKey(late)).toBe('2026-10-16')
  })

  it('校验自然日字符串', () => {
    expect(isDayKey('2026-10-16')).toBe(true)
    expect(isDayKey('2026-2-30')).toBe(false)
    expect(isDayKey('2026-13-01')).toBe(false)
    expect(isDayKey('16/10/2026')).toBe(false)
  })

  it('加减天数与差值跨月正确', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(diffDays('2026-11-01', '2026-10-31')).toBe(1)
  })

  it('一周从周一开始，正好 7 天', () => {
    expect(startOfWeek('2026-10-16')).toBe('2026-10-12')
    expect(startOfWeek('2026-10-18')).toBe('2026-10-12')
    expect(weekDates('2026-10-12')).toHaveLength(7)
    expect(weekDates('2026-10-12')[6]).toBe('2026-10-18')
    expect(eachDay('2026-10-12', '2026-10-14')).toEqual([
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
    ])
    expect(weekLabel('2026-10-12')).toContain('10月12日')
  })

  it('夜间时长按跨午夜计算', () => {
    expect(sleepDurationMinutes('22:00', '06:30')).toBe(510)
    expect(sleepDurationMinutes('23:50', '00:20')).toBe(30)
    expect(sleepDurationMinutes('22:00', null)).toBeNull()
    expect(sleepDurationMinutes(null, '06:30')).toBeNull()
  })

  it('格式化时长', () => {
    expect(formatDuration(510)).toBe('8 小时 30 分')
    expect(formatDuration(60)).toBe('1 小时')
    expect(formatDuration(45)).toBe('45 分钟')
    expect(formatDuration(null)).toBe('—')
  })

  it('平均入睡时间在夜间时间轴上计算', () => {
    expect(averageClock(['23:00', '01:00'])).toBe('00:00')
    expect(averageClock(['22:00', '22:30'])).toBe('22:15')
    expect(averageClock([])).toBeNull()
    expect(minutesToClock(1500)).toBe('01:00')
  })

  it('早上 6 点前的记录归到前一天', () => {
    expect(defaultLogDate(new Date(2026, 9, 16, 5, 30))).toBe('2026-10-15')
    expect(defaultLogDate(new Date(2026, 9, 16, 8, 0))).toBe('2026-10-16')
    expect(todayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
