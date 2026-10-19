import type { ClockTime, DayKey, ISOTime } from '../db/types'

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const CLOCK_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/** 把 Date 转成「本地自然日」字符串，绝不用 toISOString（会跨日错位） */
export function toDayKey(date: Date): DayKey {
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayKey(): DayKey {
  return toDayKey(new Date())
}

export function isDayKey(value: unknown): value is DayKey {
  if (typeof value !== 'string' || !DAY_RE.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return (
    date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
  )
}

export function assertDayKey(value: unknown, label = '日期'): DayKey {
  if (!isDayKey(value)) throw new Error(`${label}格式不正确，应为 YYYY-MM-DD`)
  return value
}

/** 解析为本地零点 */
export function dayKeyToDate(dayKey: DayKey): Date {
  assertDayKey(dayKey)
  const [y, m, d] = dayKey.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(dayKey: DayKey, days: number): DayKey {
  const date = dayKeyToDate(dayKey)
  date.setDate(date.getDate() + days)
  return toDayKey(date)
}

/** a - b，单位天 */
export function diffDays(a: DayKey, b: DayKey): number {
  const ms = dayKeyToDate(a).getTime() - dayKeyToDate(b).getTime()
  return Math.round(ms / 86400000)
}

export function eachDay(start: DayKey, end: DayKey): DayKey[] {
  const out: DayKey[] = []
  if (diffDays(end, start) < 0) return out
  let cur = start
  while (diffDays(cur, end) <= 0) {
    out.push(cur)
    cur = addDays(cur, 1)
  }
  return out
}

export function weekdayLabel(dayKey: DayKey): string {
  return WEEKDAYS[dayKeyToDate(dayKey).getDay()]
}

export function formatDay(dayKey: DayKey): string {
  const d = dayKeyToDate(dayKey)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${weekdayLabel(dayKey)}`
}

export function formatDayShort(dayKey: DayKey): string {
  const d = dayKeyToDate(dayKey)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export function relativeDayLabel(dayKey: DayKey): string {
  const today = todayKey()
  const delta = diffDays(dayKey, today)
  if (delta === 0) return '今天'
  if (delta === -1) return '昨天'
  if (delta === 1) return '明天'
  return formatDay(dayKey)
}

/** 周一为一周起点 */
export function startOfWeek(dayKey: DayKey): DayKey {
  const date = dayKeyToDate(dayKey)
  const dow = date.getDay() // 0 = 周日
  const offset = dow === 0 ? -6 : 1 - dow
  date.setDate(date.getDate() + offset)
  return toDayKey(date)
}

export function weekDates(weekStart: DayKey): DayKey[] {
  assertDayKey(weekStart)
  return eachDay(weekStart, addDays(weekStart, 6))
}

export function weekLabel(weekStart: DayKey): string {
  const start = dayKeyToDate(weekStart)
  const end = dayKeyToDate(addDays(weekStart, 6))
  const sameMonth = start.getMonth() === end.getMonth()
  const head = `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日`
  const tail = sameMonth ? `${end.getDate()}日` : `${end.getMonth() + 1}月${end.getDate()}日`
  return `${head} - ${tail}`
}

export function isClockTime(value: unknown): value is ClockTime {
  return typeof value === 'string' && CLOCK_RE.test(value)
}

export function clockToMinutes(clock: ClockTime): number {
  const [h, m] = clock.split(':').map(Number)
  return h * 60 + m
}

export function minutesToClock(minutes: number): ClockTime {
  const wrapped = ((minutes % 1440) + 1440) % 1440
  const h = `${Math.floor(wrapped / 60)}`.padStart(2, '0')
  const m = `${wrapped % 60}`.padStart(2, '0')
  return `${h}:${m}`
}

/**
 * 夜间睡眠时长（分钟）。入睡时间通常晚于 12:00，起床时间早于 12:00，
 * 因此入睡时间大于起床时间时按跨午夜处理。
 */
export function sleepDurationMinutes(
  sleepTime: ClockTime | null | undefined,
  wakeTime: ClockTime | null | undefined,
): number | null {
  if (!isClockTime(sleepTime) || !isClockTime(wakeTime)) return null
  let minutes = clockToMinutes(wakeTime) - clockToMinutes(sleepTime)
  if (minutes <= 0) minutes += 1440
  return minutes
}

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '—'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h <= 0) return `${m} 分钟`
  if (m === 0) return `${h} 小时`
  return `${h} 小时 ${m} 分`
}

export function nowISO(): ISOTime {
  return new Date().toISOString()
}

export function isValidISOTime(value: unknown): value is ISOTime {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

export function formatDateTime(iso: ISOTime): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const hh = `${d.getHours()}`.padStart(2, '0')
  const mm = `${d.getMinutes()}`.padStart(2, '0')
  return `${formatDay(toDayKey(d))} ${hh}:${mm}`
}

/** ISO → <input type="datetime-local"> 的值（本地时间） */
export function toLocalInputValue(iso: ISOTime): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => `${n}`.padStart(2, '0')
  return `${toDayKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromLocalInputValue(value: string): ISOTime {
  if (!value) throw new Error('时间不能为空')
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) throw new Error('时间格式不正确')
  return d.toISOString()
}

/** 默认的睡眠记录归属日：早上 6 点前算前一天的记录日 */
export function defaultLogDate(now = new Date()): DayKey {
  const key = toDayKey(now)
  return now.getHours() < 6 ? addDays(key, -1) : key
}
