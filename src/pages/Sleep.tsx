import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { repo } from '../db/repo'
import { useApp } from '../app/AppProvider'
import {
  Card,
  ConfirmDialog,
  EmptyState,
  Errors,
  InputField,
  LiveMessage,
  Metric,
  Notice,
  OptionChips,
  PageHeader,
  TextAreaField,
  useToastState,
} from '../components/ui'
import {
  DAYTIME_SLEEPINESS,
  LABELS,
  MORNING_STATE,
  NIGHT_CONGESTION,
  NIGHT_COUGH,
  NIGHT_WAKING,
  SNORING,
  type DailyLog,
  type DayKey,
} from '../db/types'
import {
  defaultLogDate,
  formatDay,
  formatDuration,
  isDayKey,
  relativeDayLabel,
  sleepDurationMinutes,
  todayKey,
} from '../lib/date'
import { sleepObservation } from '../lib/feedback'
import { SleepTimeline } from '../components/charts'

function toOptions<T extends string>(allowed: readonly T[], labels: Record<T, string>) {
  return allowed.map((value) => ({ value, label: labels[value] }))
}

interface Draft {
  date: DayKey
  sleepTime: string
  wakeTime: string
  nightCongestion: DailyLog['nightCongestion']
  nightCough: DailyLog['nightCough']
  snoring: DailyLog['snoring']
  nightWaking: DailyLog['nightWaking']
  morningState: DailyLog['morningState']
  daytimeSleepiness: DailyLog['daytimeSleepiness']
  note: string
}

const DEFAULT_DRAFT: Draft = {
  date: todayKey(),
  sleepTime: '',
  wakeTime: '',
  nightCongestion: 'none',
  nightCough: 'none',
  snoring: 'no',
  nightWaking: 'none',
  morningState: 'refreshed',
  daytimeSleepiness: 'none',
  note: '',
}

function fromLog(log: DailyLog): Draft {
  return {
    date: log.date,
    sleepTime: log.sleepTime ?? '',
    wakeTime: log.wakeTime ?? '',
    nightCongestion: log.nightCongestion,
    nightCough: log.nightCough,
    snoring: log.snoring,
    nightWaking: log.nightWaking,
    morningState: log.morningState,
    daytimeSleepiness: log.daytimeSleepiness,
    note: log.note ?? '',
  }
}

export function Sleep() {
  const { profile } = useApp()
  const childId = profile?.id
  const [draft, setDraft] = useState<Draft>({ ...DEFAULT_DRAFT, date: defaultLogDate() })
  const [errors, setErrors] = useState<string[]>([])
  const [confirmDelete, setConfirmDelete] = useState<DailyLog | null>(null)
  const toast = useToastState()

  const logs = useLiveQuery(
    async () => (childId ? repo.listDailyLogs(childId) : []),
    [childId],
  )
  const existing = useMemo(
    () => (logs ?? []).find((l) => l.date === draft.date),
    [logs, draft.date],
  )

  useEffect(() => {
    setDraft(existing ? fromLog(existing) : { ...DEFAULT_DRAFT, date: draft.date })
    // 只在切换日期时同步表单，避免边输入边被覆盖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.date, existing?.updatedAt])

  const recent = useMemo(() => {
    const rows = [...(logs ?? [])]
    rows.sort((a, b) => b.date.localeCompare(a.date))
    return rows.slice(0, 14).reverse()
  }, [logs])

  const durations = recent
    .map((l) => sleepDurationMinutes(l.sleepTime, l.wakeTime))
    .filter((v): v is number => v !== null)
  const avgDuration =
    durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null
  const coughDays = recent.filter((l) => l.nightCough && l.nightCough !== 'none').length
  const selectedDayLabel = isDayKey(draft.date) ? relativeDayLabel(draft.date) : '所选日期'
  async function save() {
    if (!childId) return
    const result = await repo
      .saveDailyLog({
        childId,
        ...draft,
        sleepTime: draft.sleepTime || null,
        wakeTime: draft.wakeTime || null,
        note: draft.note || null,
      })
      .catch((err: Error) => err)
    if (result instanceof Error) {
      setErrors(result.message.split('；'))
      return
    }
    setErrors([])
    toast.show(existing ? '这天的记录已更新' : '这天的记录已保存')
  }

  return (
    <>
      <LiveMessage message={toast.message} clear={toast.clear} />
      <PageHeader
        title="身体与睡眠记录"
        intro="每天花半分钟勾选项就够了，可以随时补录和修改。这里只做记录，不做诊断。"
      />

      <Card
        title={existing ? `修改 ${selectedDayLabel} 的记录` : `记录 ${selectedDayLabel}`}
        actions={<Link className="btn btn-sm" to="/print/sleep">就医摘要</Link>}
      >
        <Errors errors={errors} />
        {!existing && <p className="muted">已预选「无不适、精神不错」。有不同情况再修改，确认后点击保存。入睡和起床时间按实际填写。</p>}
        <InputField
          label="记录日期"
          type="date"
          value={draft.date}
          max={todayKey()}
          onChange={(value) => setDraft((d) => ({ ...d, date: value }))}
          hint="以起床那一天作为记录日；早上 6 点前填的都算前一天"
        />
        <div className="grid-2">
          <InputField
            label="入睡时间"
            type="time"
            value={draft.sleepTime}
            onChange={(value) => setDraft((d) => ({ ...d, sleepTime: value }))}
          />
          <InputField
            label="起床时间"
            type="time"
            value={draft.wakeTime}
            onChange={(value) => setDraft((d) => ({ ...d, wakeTime: value }))}
          />
        </div>
        <p className="muted">
          夜间时长：
          {formatDuration(sleepDurationMinutes(draft.sleepTime || null, draft.wakeTime || null))}
        </p>
        <OptionChips
          legend="夜间鼻塞"
          options={toOptions(NIGHT_CONGESTION, LABELS.nightCongestion)}
          value={draft.nightCongestion}
          onChange={(value) => setDraft((d) => ({ ...d, nightCongestion: value }))}
        />
        <OptionChips
          legend="夜间咳嗽"
          options={toOptions(NIGHT_COUGH, LABELS.nightCough)}
          value={draft.nightCough}
          onChange={(value) => setDraft((d) => ({ ...d, nightCough: value }))}
        />
        <OptionChips
          legend="打鼾或张口呼吸（可选）"
          options={toOptions(SNORING, LABELS.snoring)}
          value={draft.snoring}
          onChange={(value) => setDraft((d) => ({ ...d, snoring: value }))}
        />
        <OptionChips
          legend="夜间醒来情况"
          options={toOptions(NIGHT_WAKING, LABELS.nightWaking)}
          value={draft.nightWaking}
          onChange={(value) => setDraft((d) => ({ ...d, nightWaking: value }))}
        />
        <OptionChips
          legend="晨起精神状态"
          options={toOptions(MORNING_STATE, LABELS.morningState)}
          value={draft.morningState}
          onChange={(value) => setDraft((d) => ({ ...d, morningState: value }))}
        />
        <OptionChips
          legend="白天困倦情况"
          options={toOptions(DAYTIME_SLEEPINESS, LABELS.daytimeSleepiness)}
          value={draft.daytimeSleepiness}
          onChange={(value) => setDraft((d) => ({ ...d, daytimeSleepiness: value }))}
        />
        <TextAreaField
          label="备注（可选）"
          value={draft.note}
          onChange={(value) => setDraft((d) => ({ ...d, note: value }))}
          hint="例如：睡前看了 20 分钟视频、白天有体育课"
        />
        <div className="row">
          <button type="button" className="btn btn-primary" onClick={save}>
            {existing ? '保存修改' : '保存这天的记录'}
          </button>
          {existing && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => setConfirmDelete(existing)}
            >
              删除这天的记录
            </button>
          )}
        </div>
        {existing && (
          <p className="muted" style={{ marginTop: 8 }}>
            {sleepObservation({ ...existing, ...draft, id: existing.id } as DailyLog)}
          </p>
        )}
      </Card>

      <Card title="最近 14 天的记录">
        {recent.length === 0 ? (
          <EmptyState text="还没有记录。今晚或明早记录一次，就能看到第一根柱子。" />
        ) : (
          <>
            <div className="metrics">
              <Metric label="平均夜间时长" value={formatDuration(avgDuration)} />
              <Metric label="有夜间咳嗽" value={`${coughDays} 天`} />
              <Metric label="记录天数" value={`${recent.length} 天`} />
            </div>
            <div style={{ margin: '16px 0 4px' }}>
              <SleepTimeline
                rows={recent.map((log) => ({
                  date: log.date,
                  sleepTime: log.sleepTime,
                  wakeTime: log.wakeTime,
                  morningState: log.morningState,
                  nightWaking: log.nightWaking,
                }))}
              />
            </div>
            <ul className="list">
              {[...recent].reverse().map((log) => (
                <li className="list-item" key={log.id}>
                  <div className="list-item-head">
                    <h3>{formatDay(log.date)}</h3>
                    <span className="tag">{formatDuration(sleepDurationMinutes(log.sleepTime, log.wakeTime))}</span>
                  </div>
                  <p className="muted">{sleepObservation(log)}</p>
                  <div className="row">
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => setDraft(fromLog(log))}
                    >
                      修改
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => setConfirmDelete(log)}
                    >
                      删除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Notice variant="warn">
        这里不提供疾病判断、用药建议，也不会自动推断原因。如果记录里连续出现鼻塞、咳嗽、张口呼吸或白天很困，把就医摘要打印出来带给医生看。
      </Notice>

      <ConfirmDialog
        open={confirmDelete !== null}
        title="删除这条记录？"
        description={
          <p>
            将删除 {confirmDelete ? formatDay(confirmDelete.date) : ''} 的睡眠与身体记录，删除后无法恢复。
          </p>
        }
        confirmLabel="删除"
        danger
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return
          await repo.deleteRecord('dailyLogs', confirmDelete.id)
          setConfirmDelete(null)
          toast.show('这条记录已删除')
        }}
      />
    </>
  )
}
