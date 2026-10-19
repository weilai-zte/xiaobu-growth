import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { repo } from '../db/repo'
import { useApp } from '../app/AppProvider'
import {
  Card,
  EmptyState,
  LiveMessage,
  Metric,
  Notice,
  PageHeader,
  TextAreaField,
  useToastState,
} from '../components/ui'
import { LABELS, type DayKey, type WeeklyReview } from '../db/types'
import {
  addDays,
  formatDuration,
  startOfWeek,
  todayKey,
  weekDates,
  weekLabel,
} from '../lib/date'
import {
  buildWeeklySummary,
  factualObservations,
  insufficientDataNotes,
} from '../lib/insights'
import { StackedBars, SleepTimeline, buildStacks, type SleepRow } from '../components/charts'

interface ReviewDraft {
  improvements: string
  difficulties: string
  effectiveSupport: string
  conflictSources: string
  nextAdjustments: string
}

const EMPTY_REVIEW: ReviewDraft = {
  improvements: '',
  difficulties: '',
  effectiveSupport: '',
  conflictSources: '',
  nextAdjustments: '',
}

export function Weekly() {
  const { profile } = useApp()
  const childId = profile?.id
  const toast = useToastState()
  const [weekStart, setWeekStart] = useState<DayKey>(startOfWeek(todayKey()))
  const [draft, setDraft] = useState<ReviewDraft>(EMPTY_REVIEW)
  const [reviewId, setReviewId] = useState<string | null>(null)

  const weekEnd = addDays(weekStart, 6)
  const data = useLiveQuery(
    async () => {
      if (!childId) return null
      const [dailyLogs, taskRecords, rules, checks, conflicts, strengths, experiments] =
        await Promise.all([
          repo.listDailyLogs(childId),
          repo.listTaskRecords(childId),
          repo.listRules(childId),
          repo.listChecks(childId),
          repo.listConflicts(childId),
          repo.listStrengths(childId),
          repo.listExperiments(childId),
        ])
      return { dailyLogs, taskRecords, rules, checks, conflicts, strengths, experiments }
    },
    [childId],
  )
  const reviews = useLiveQuery(
    async () => (childId ? repo.listWeeklyReviews(childId) : []),
    [childId],
  )

  const summary = useMemo(() => {
    if (!data) return null
    return buildWeeklySummary({ weekStart, ...data })
  }, [data, weekStart])

  const existingReview: WeeklyReview | undefined = useMemo(
    () => (reviews ?? []).find((r) => r.weekStart === weekStart),
    [reviews, weekStart],
  )

  useEffect(() => {
    if (existingReview) {
      setReviewId(existingReview.id)
      setDraft({
        improvements: existingReview.improvements ?? '',
        difficulties: existingReview.difficulties ?? '',
        effectiveSupport: existingReview.effectiveSupport ?? '',
        conflictSources: existingReview.conflictSources ?? '',
        nextAdjustments: existingReview.nextAdjustments ?? '',
      })
    } else {
      setReviewId(null)
      setDraft(EMPTY_REVIEW)
    }
  }, [existingReview?.id, existingReview?.updatedAt, weekStart])

  const observations = summary ? factualObservations(summary) : []
  const notes = summary ? insufficientDataNotes(summary) : []

  const weekDays = useMemo(() => weekDates(weekStart), [weekStart])

  const weekSleepRows = useMemo<SleepRow[]>(() => {
    if (!data) return []
    const byDate = new Map(
      data.dailyLogs
        .filter((log) => log.date >= weekStart && log.date <= weekEnd)
        .map((log) => [log.date, log]),
    )
    const rows: Array<SleepRow | null> = weekDays.map((date) => {
      const log = byDate.get(date)
      if (!log) return null
      return {
        date,
        sleepTime: log.sleepTime,
        wakeTime: log.wakeTime,
        morningState: log.morningState,
        nightWaking: log.nightWaking,
      }
    })
    return rows.filter((row): row is SleepRow => row !== null)
  }, [data, weekDays, weekStart, weekEnd])

  const weekTaskStacks = useMemo(() => {
    const rows = (data?.taskRecords ?? [])
      .filter((record) => record.date >= weekStart && record.date <= weekEnd)
      .map((record) => ({
        date: record.date,
        key: record.subject.trim() || '未填学科',
        value: record.actualMinutes ?? 0,
      }))
    return buildStacks(rows, weekDays, { restLabel: '其余学科' })
  }, [data, weekDays, weekStart, weekEnd])

  return (
    <>
      <LiveMessage message={toast.message} clear={toast.clear} />
      <PageHeader
        title="每周复盘"
        intro="这里只汇总已经记录的事实。结论由家长自己写，系统不会替你下判断。"
      />

      <Card title="选择这一周">
        <p>{weekLabel(weekStart)}</p>
        <div className="row">
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
          >
            上一周
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setWeekStart(startOfWeek(todayKey()))}
          >
            回到本周
          </button>
          <button
            type="button"
            className="btn btn-sm"
            disabled={weekStart >= startOfWeek(todayKey())}
            onClick={() => setWeekStart(addDays(weekStart, 7))}
          >
            下一周
          </button>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          本周数据统计区间：{weekStart} 至 {weekEnd}
        </p>
      </Card>

      {!summary ? (
        <Card title="本周汇总">
          <EmptyState text="正在读取本地数据…" />
        </Card>
      ) : (
        <>
          <Card title="本周事实汇总">
            {notes.length > 0 && (
              <div className="insufficient">
                <strong>数据不足的地方</strong>
                <ul>
                  {notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
            )}
            <ul className="list">
              {observations.map((line) => (
                <li className="list-item" key={line}>
                  {line}
                </li>
              ))}
            </ul>
          </Card>

          <Card title="睡眠与晨起">
            <div className="metrics">
              <Metric
                label="平均夜间时长"
                value={
                  summary.sleep.available
                    ? formatDuration(
                        summary.sleep.averageSleepMinutes === null
                          ? null
                          : Math.round(summary.sleep.averageSleepMinutes),
                      )
                    : '数据不足'
                }
              />
              <Metric
                label="平均入睡"
                value={summary.sleep.available ? summary.sleep.averageSleepTime ?? '—' : '数据不足'}
              />
              <Metric
                label="平均起床"
                value={summary.sleep.available ? summary.sleep.averageWakeTime ?? '—' : '数据不足'}
              />
              <Metric label="记录天数" value={`${summary.sleep.loggedDays} 天`} />
              <Metric label="夜间咳嗽" value={`${summary.sleep.nightCoughDays} 天`} />
              <Metric label="晨起较累" value={`${summary.sleep.morningTiredDays} 天`} />
            </div>
            {weekSleepRows.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <SleepTimeline rows={weekSleepRows} />
              </div>
            )}
          </Card>

          <Card title="学习任务">
            {!summary.tasks.available ? (
              <EmptyState text="本周没有学习任务记录。" />
            ) : (
              <div className="metrics">
                <Metric label="任务次数" value={summary.tasks.total} />
                <Metric label="独立启动" value={summary.tasks.independentStart} />
                <Metric label="一次提醒后启动" value={summary.tasks.oneReminderStart} />
                <Metric label="需要多次提醒" value={summary.tasks.multiReminderStart} />
                <Metric label="独立完成" value={summary.tasks.completed} />
                <Metric label="部分完成" value={summary.tasks.partial} />
                <Metric label="未完成" value={summary.tasks.notDone} />
                <Metric
                  label="累计学习时长"
                  value={
                    summary.tasks.totalMinutes === null
                      ? '未记录'
                      : `${summary.tasks.totalMinutes} 分钟`
                  }
                />
              </div>
            )}
            {summary.tasks.barriers.length > 0 && (
              <p className="muted" style={{ marginTop: 10 }}>
                记录到的困难：
                {summary.tasks.barriers
                  .map((b) => `${b.label} ${b.count} 次`)
                  .join('，')}
              </p>
            )}
            {weekTaskStacks.series.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <StackedBars
                  title="本周每天的学习投入（按学科堆叠）"
                  days={weekTaskStacks.days}
                  series={weekTaskStacks.series}
                  emptyText="本周的任务还没有填过「实际用时」。"
                  note="只统计填了「实际用时」的记录，没填的不折算也不估算。"
                />
              </div>
            )}
          </Card>

          <Card title="生活规则与手机使用">
            {!summary.rules.available ? (
              <EmptyState text="本周没有规则执行记录。" />
            ) : (
              <>
                <div className="metrics">
                  <Metric label="执行记录" value={summary.rules.checks} />
                  <Metric label="做到" value={summary.rules.done} />
                  <Metric label="做到一部分" value={summary.rules.partial} />
                  <Metric label="这次没做到" value={summary.rules.notDone} />
                  <Metric label="不适用" value={summary.rules.notApplicable} />
                </div>
                <p className="muted" style={{ marginTop: 10 }}>
                  手机与视频约定：记录 {summary.rules.screenChecks} 次，按约定做到{' '}
                  {summary.rules.screenDone} 次。
                </p>
              </>
            )}
          </Card>

          <Card title="家庭冲突与优势事例">
            <div className="metrics">
              <Metric label="冲突记录" value={`${summary.conflicts.count} 次`} />
              <Metric label="家长连续催促" value={`${summary.conflicts.naggingCount} 次`} />
              <Metric label="出现比较" value={`${summary.conflicts.comparisonCount} 次`} />
              <Metric label="已经修复" value={`${summary.conflicts.repairedCount} 次`} />
              <Metric label="优势事例" value={`${summary.strengths.count} 件`} />
            </div>
            {summary.conflicts.byTrigger.length > 0 && (
              <p className="muted" style={{ marginTop: 10 }}>
                冲突情境：
                {summary.conflicts.byTrigger
                  .map((c) => `${c.label} ${c.count} 次`)
                  .join('，')}
              </p>
            )}
            {summary.strengths.byCategory.length > 0 && (
              <p className="muted">
                优势类别：
                {summary.strengths.byCategory
                  .map((c) => `${c.label} ${c.count} 件`)
                  .join('，')}
              </p>
            )}
          </Card>

          <Card title="进行中的家庭实验">
            {summary.experiments.running.length === 0 ? (
              <EmptyState text="本周没有进行中的实验。" />
            ) : (
              <ul className="list">
                {summary.experiments.running.map((exp) => (
                  <li className="list-item" key={exp.id}>
                    <div className="list-item-head">
                      <h3>{exp.problem}</h3>
                      <span className="tag">
                        {exp.startDate} - {exp.endDate}
                      </span>
                    </div>
                    <p className="muted">调整措施：{exp.adjustment}</p>
                    <p className="muted">
                      观察指标：{exp.metrics.join('、')}
                      {exp.result ? ` · 目前结果：${LABELS.experimentResult[exp.result]}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <Link className="btn btn-sm" to="/experiments">
              管理实验
            </Link>
          </Card>
        </>
      )}

      <Card title="家长复盘表">
        <p className="muted">
          {reviewId ? '这一周的复盘已经填写过，可以继续修改。' : '这一周还没有填写复盘。'}
        </p>
        <TextAreaField
          label="1. 本周有什么改善？"
          value={draft.improvements}
          onChange={(improvements) => setDraft({ ...draft, improvements })}
        />
        <TextAreaField
          label="2. 哪些情境仍然困难？"
          value={draft.difficulties}
          onChange={(difficulties) => setDraft({ ...draft, difficulties })}
        />
        <TextAreaField
          label="3. 哪种支持方式比较有效？"
          value={draft.effectiveSupport}
          onChange={(effectiveSupport) => setDraft({ ...draft, effectiveSupport })}
        />
        <TextAreaField
          label="4. 哪些方法增加了冲突？"
          value={draft.conflictSources}
          onChange={(conflictSources) => setDraft({ ...draft, conflictSources })}
        />
        <TextAreaField
          label="5. 下周只准备调整哪一两件事？"
          value={draft.nextAdjustments}
          onChange={(nextAdjustments) => setDraft({ ...draft, nextAdjustments })}
          hint="只写一两件，太多了这一周执行不下来。"
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={async () => {
            if (!childId) return
            await repo.saveWeeklyReview({ childId, weekStart, ...draft })
            toast.show('本周复盘已保存')
          }}
        >
          保存复盘
        </button>
      </Card>

      <Notice variant="warn">
        汇总只做计数与平均值，不写「因为…所以…」，也不判断孩子是否进步。变化的原因需要家长结合当时的情况自己判断。
      </Notice>
    </>
  )
}
