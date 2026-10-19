import type {
  Barrier,
  ConflictLog,
  DailyLog,
  DayKey,
  Experiment,
  RoutineCheck,
  RoutineRule,
  StrengthCategory,
  StrengthMoment,
  TaskRecord,
} from '../db/types'
import { LABELS } from '../db/types'
import {
  addDays,
  clockToMinutes,
  formatDuration,
  minutesToClock,
  sleepDurationMinutes,
  weekDates,
} from './date'

export interface Counted<T extends string> {
  key: T
  label: string
  count: number
}

export interface WeeklySummary {
  weekStart: DayKey
  weekEnd: DayKey
  days: DayKey[]
  sleep: {
    available: boolean
    loggedDays: number
    averageSleepMinutes: number | null
    averageSleepTime: string | null
    averageWakeTime: string | null
    nightCoughDays: number
    nightCongestionDays: number
    snoringDays: number
    nightWakingDays: number
    morningTiredDays: number
    daytimeSleepinessDays: number
  }
  tasks: {
    available: boolean
    total: number
    independentStart: number
    oneReminderStart: number
    multiReminderStart: number
    completed: number
    partial: number
    notDone: number
    noAnswer: number
    totalMinutes: number | null
    barriers: Counted<Barrier>[]
  }
  rules: {
    available: boolean
    activeRules: number
    checks: number
    done: number
    partial: number
    notDone: number
    notApplicable: number
    screenChecks: number
    screenDone: number
  }
  conflicts: {
    available: boolean
    count: number
    byTrigger: Counted<string>[]
    naggingCount: number
    comparisonCount: number
    repairedCount: number
  }
  strengths: {
    available: boolean
    count: number
    byCategory: Counted<StrengthCategory>[]
  }
  experiments: {
    running: Experiment[]
    finished: Experiment[]
  }
}

const MIN_SLEEP_DAYS = 3

export function average(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

/**
 * 入睡时间的平均值按「夜间时间轴」计算：中午 12 点之前的时刻算作 +24h，
 * 这样 23:30 与 00:30 的平均不会算错。
 */
export function averageClock(times: string[]): string | null {
  if (times.length === 0) return null
  const adjusted = times.map((t) => {
    const minutes = clockToMinutes(t)
    return minutes < 720 ? minutes + 1440 : minutes
  })
  const avg = adjusted.reduce((a, b) => a + b, 0) / adjusted.length
  return minutesToClock(Math.round(avg))
}

function countBy<T extends string>(
  values: T[],
  allowed: readonly T[],
  labels: Record<T, string>,
): Counted<T>[] {
  return allowed
    .map((key) => ({
      key,
      label: labels[key],
      count: values.filter((v) => v === key).length,
    }))
    .filter((row) => row.count > 0)
}

export interface WeeklyInput {
  weekStart: DayKey
  dailyLogs: DailyLog[]
  taskRecords: TaskRecord[]
  rules: RoutineRule[]
  checks: RoutineCheck[]
  conflicts: ConflictLog[]
  strengths: StrengthMoment[]
  experiments: Experiment[]
}

export function buildWeeklySummary(input: WeeklyInput): WeeklySummary {
  const days = weekDates(input.weekStart)
  const weekEnd = addDays(input.weekStart, 6)
  const inWeek = (day: DayKey) => day >= input.weekStart && day <= weekEnd

  const logs = input.dailyLogs.filter((l) => inWeek(l.date))
  const sleepDurations = logs
    .map((l) => sleepDurationMinutes(l.sleepTime, l.wakeTime))
    .filter((v): v is number => v !== null)
  const sleepTimes = logs.map((l) => l.sleepTime).filter((v): v is string => !!v)
  const wakeTimes = logs.map((l) => l.wakeTime).filter((v): v is string => !!v)

  const tasks = input.taskRecords.filter((t) => inWeek(t.date))
  const taskMinutes = tasks
    .map((t) => t.actualMinutes)
    .filter((v): v is number => v !== null && v !== undefined)

  const activeRules = input.rules.filter((r) => r.active)
  const checks = input.checks.filter((c) => inWeek(c.date))
  const ruleById = new Map(input.rules.map((r) => [r.id, r]))
  const screenRuleIds = new Set(
    input.rules.filter((r) => r.trigger === 'screen').map((r) => r.id),
  )
  const screenChecks = checks.filter((c) => screenRuleIds.has(c.ruleId))
  // 只统计仍然存在的规则的执行记录，避免删掉规则后数字对不上
  const validChecks = checks.filter((c) => ruleById.has(c.ruleId))

  const conflicts = input.conflicts.filter((c) => inWeek(c.occurredAt.slice(0, 10)))
  const strengths = input.strengths.filter((s) => inWeek(s.date))

  const today = new Date()
  const todayKeyLocal = `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, '0')}-${`${today.getDate()}`.padStart(2, '0')}`
  const running: Experiment[] = []
  const finished: Experiment[] = []
  for (const exp of input.experiments) {
    if (exp.startDate > weekEnd) continue
    if (exp.endDate < input.weekStart && exp.endDate < todayKeyLocal) finished.push(exp)
    else running.push(exp)
  }

  return {
    weekStart: input.weekStart,
    weekEnd,
    days,
    sleep: {
      available: logs.length >= MIN_SLEEP_DAYS,
      loggedDays: logs.length,
      averageSleepMinutes: average(sleepDurations),
      averageSleepTime: averageClock(sleepTimes),
      averageWakeTime: averageClock(wakeTimes),
      nightCoughDays: logs.filter((l) => l.nightCough && l.nightCough !== 'none').length,
      nightCongestionDays: logs.filter(
        (l) => l.nightCongestion && l.nightCongestion !== 'none',
      ).length,
      snoringDays: logs.filter((l) => l.snoring && l.snoring !== 'no').length,
      nightWakingDays: logs.filter((l) => l.nightWaking && l.nightWaking !== 'none').length,
      morningTiredDays: logs.filter(
        (l) => l.morningState === 'tired' || l.morningState === 'very_tired',
      ).length,
      daytimeSleepinessDays: logs.filter(
        (l) => l.daytimeSleepiness && l.daytimeSleepiness !== 'none',
      ).length,
    },
    tasks: {
      available: tasks.length > 0,
      total: tasks.length,
      independentStart: tasks.filter((t) => t.startMode === 'independent').length,
      oneReminderStart: tasks.filter((t) => t.startMode === 'one_reminder').length,
      multiReminderStart: tasks.filter((t) => t.startMode === 'multi_reminder').length,
      completed: tasks.filter((t) => t.completion === 'independent').length,
      partial: tasks.filter((t) => t.completion === 'partial').length,
      notDone: tasks.filter((t) => t.completion === 'not_done').length,
      noAnswer: tasks.filter((t) => !t.completion).length,
      totalMinutes: taskMinutes.length > 0 ? taskMinutes.reduce((a, b) => a + b, 0) : null,
      barriers: countBy(
        tasks.flatMap((t) => t.barriers),
        ['cannot_do', 'hard_to_start', 'distracted', 'tired', 'emotion', 'other'] as const,
        LABELS.barrier,
      ),
    },
    rules: {
      available: validChecks.length > 0,
      activeRules: activeRules.length,
      checks: validChecks.length,
      done: validChecks.filter((c) => c.status === 'done').length,
      partial: validChecks.filter((c) => c.status === 'partial').length,
      notDone: validChecks.filter((c) => c.status === 'not_done').length,
      notApplicable: validChecks.filter((c) => c.status === 'not_applicable').length,
      screenChecks: screenChecks.length,
      screenDone: screenChecks.filter((c) => c.status === 'done').length,
    },
    conflicts: {
      available: conflicts.length > 0,
      count: conflicts.length,
      byTrigger: countBy(
        conflicts.map((c) => c.trigger),
        ['toy', 'attention', 'rule_inconsistency', 'screen', 'study', 'other'] as const,
        LABELS.conflictTrigger,
      ),
      naggingCount: conflicts.filter((c) => c.parentNagging === true).length,
      comparisonCount: conflicts.filter((c) => c.parentComparison === true).length,
      repairedCount: conflicts.filter((c) => c.repaired === 'yes').length,
    },
    strengths: {
      available: strengths.length > 0,
      count: strengths.length,
      byCategory: countBy(
        strengths.map((s) => s.category),
        ['sport', 'create', 'care', 'organize', 'solve', 'other'] as const,
        LABELS.strength,
      ),
    },
    experiments: { running, finished },
  }
}

/**
 * 只输出「观察到的事实」，不写因为/所以这类因果判断，也不下结论。
 * 有测试守着，避免以后误加自动分析。
 */
export function factualObservations(summary: WeeklySummary): string[] {
  const out: string[] = []
  const s = summary.sleep
  if (s.loggedDays === 0) {
    out.push('本周没有睡眠记录。')
  } else if (!s.available) {
    out.push(`本周记录了 ${s.loggedDays} 天睡眠，不足 ${MIN_SLEEP_DAYS} 天，暂不做趋势描述。`)
  } else {
    out.push(
      `本周记录了 ${s.loggedDays} 天睡眠，平均夜间时长约 ${formatDuration(
        s.averageSleepMinutes === null ? null : Math.round(s.averageSleepMinutes),
      )}${s.averageSleepTime ? `，平均入睡 ${s.averageSleepTime}` : ''}${
        s.averageWakeTime ? `，平均起床 ${s.averageWakeTime}` : ''
      }。`,
    )
    out.push(
      `夜间出现鼻塞 ${s.nightCongestionDays} 天，咳嗽 ${s.nightCoughDays} 天，打鼾或张口呼吸 ${s.snoringDays} 天，夜间醒来 ${s.nightWakingDays} 天；晨起较累 ${s.morningTiredDays} 天，白天困倦 ${s.daytimeSleepinessDays} 天。`,
    )
  }

  const t = summary.tasks
  if (!t.available) {
    out.push('本周没有学习任务记录。')
  } else {
    out.push(
      `本周记录了 ${t.total} 次学习任务：独立启动 ${t.independentStart} 次，提醒一次后启动 ${t.oneReminderStart} 次，需要多次提醒 ${t.multiReminderStart} 次。`,
    )
    out.push(
      `完成情况：独立完成 ${t.completed} 次，部分完成 ${t.partial} 次，未完成 ${t.notDone} 次。`,
    )
    if (t.barriers.length > 0) {
      out.push(
        `记录到的困难：${t.barriers.map((b) => `${b.label} ${b.count} 次`).join('，')}。`,
      )
    }
  }

  const r = summary.rules
  if (!r.available) {
    out.push('本周没有规则执行记录。')
  } else {
    out.push(
      `本周有 ${r.checks} 条规则执行记录：做到 ${r.done} 次，做到一部分 ${r.partial} 次，这次没做到 ${r.notDone} 次，不适用 ${r.notApplicable} 次。`,
    )
    if (r.screenChecks > 0) {
      out.push(`其中手机与视频约定记录了 ${r.screenChecks} 次，按约定做到 ${r.screenDone} 次。`)
    }
  }

  if (summary.conflicts.count === 0) {
    out.push('本周没有家庭冲突记录（可能是没有发生，也可能是没有记录）。')
  } else {
    out.push(
      `本周记录了 ${summary.conflicts.count} 次冲突，情境分布：${summary.conflicts.byTrigger
        .map((c) => `${c.label} ${c.count} 次`)
        .join('，')}。`,
    )
    out.push(
      `其中家长记录到自己连续催促 ${summary.conflicts.naggingCount} 次、出现兄弟比较 ${summary.conflicts.comparisonCount} 次，冲突已修复 ${summary.conflicts.repairedCount} 次。`,
    )
  }

  if (summary.strengths.count === 0) {
    out.push('本周没有优势事例记录。')
  } else {
    out.push(
      `本周记录了 ${summary.strengths.count} 件优势事例：${summary.strengths.byCategory
        .map((c) => `${c.label} ${c.count} 件`)
        .join('，')}。`,
    )
  }
  return out
}

export function insufficientDataNotes(summary: WeeklySummary): string[] {
  const notes: string[] = []
  if (summary.sleep.loggedDays === 0) notes.push('睡眠：本周 0 天记录，无法呈现趋势。')
  else if (!summary.sleep.available)
    notes.push(`睡眠：只有 ${summary.sleep.loggedDays} 天记录，样本太少，不做趋势描述。`)
  if (!summary.tasks.available) notes.push('学习任务：本周没有记录。')
  if (!summary.rules.available) notes.push('生活规则：本周没有执行记录。')
  if (!summary.conflicts.available)
    notes.push('家庭冲突：本周没有记录，不能判断是变好还是没有记录。')
  if (!summary.strengths.available) notes.push('优势事例：本周没有记录。')
  return notes
}

export interface PeriodCounts {
  taskRecords: number
  independentStart: number
  completedTasks: number
  partialTasks: number
  ruleChecks: number
  ruleDone: number
  conflicts: number
  strengths: number
  sleepLoggedDays: number
  days: number
}

/** 观察期内的纯计数，用于实验页面，不做任何因果解释 */
export function buildPeriodCounts(
  input: {
    taskRecords: TaskRecord[]
    checks: RoutineCheck[]
    conflicts: ConflictLog[]
    strengths: StrengthMoment[]
    dailyLogs: DailyLog[]
  },
  start: DayKey,
  end: DayKey,
): PeriodCounts {
  const inRange = (day: DayKey) => day >= start && day <= end
  const tasks = input.taskRecords.filter((t) => inRange(t.date))
  const checks = input.checks.filter((c) => inRange(c.date))
  const conflicts = input.conflicts.filter((c) => inRange(c.occurredAt.slice(0, 10)))
  const strengths = input.strengths.filter((s) => inRange(s.date))
  const logs = input.dailyLogs.filter((l) => inRange(l.date))
  const span = Math.max(0, daysBetweenInclusive(start, end))
  return {
    taskRecords: tasks.length,
    independentStart: tasks.filter((t) => t.startMode === 'independent').length,
    completedTasks: tasks.filter((t) => t.completion === 'independent').length,
    partialTasks: tasks.filter((t) => t.completion === 'partial').length,
    ruleChecks: checks.length,
    ruleDone: checks.filter((c) => c.status === 'done').length,
    conflicts: conflicts.length,
    strengths: strengths.length,
    sleepLoggedDays: logs.length,
    days: span,
  }
}

function daysBetweenInclusive(start: DayKey, end: DayKey): number {
  const a = new Date(`${start}T00:00:00`).getTime()
  const b = new Date(`${end}T00:00:00`).getTime()
  return Math.round((b - a) / 86400000) + 1
}
