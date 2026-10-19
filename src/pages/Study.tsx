import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { repo } from '../db/repo'
import { useApp } from '../app/AppProvider'
import {
  Card,
  ConfirmDialog,
  EmptyState,
  Errors,
  LiveMessage,
  Notice,
  PageHeader,
  SelectField,
  TextField,
  useToastState,
} from '../components/ui'
import {
  EMPTY_COMPLETION_DRAFT,
  EMPTY_TEMPLATE_DRAFT,
  TaskCompletionFields,
  TaskTemplateForm,
  draftFromRecord,
  type TemplateDraft,
} from '../components/TaskForms'
import { LABELS, type TaskRecord, type TaskTemplate, type TaskTimer } from '../db/types'
import { addDays, eachDay, nowISO, todayKey } from '../lib/date'
import { taskFeedback } from '../lib/feedback'
import { validateTaskTemplate } from '../lib/validate'
import { StackedBars, buildStacks } from '../components/charts'

function elapsedMs(timer: TaskTimer | null, nowMs: number): number {
  if (!timer) return 0
  const running = timer.runningSince ? nowMs - Date.parse(timer.runningSince) : 0
  return timer.accumulatedMs + Math.max(0, running)
}

function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${`${minutes}`.padStart(2, '0')}:${`${seconds}`.padStart(2, '0')}`
}

export function Study() {
  const { profile } = useApp()
  const childId = profile?.id
  const today = todayKey()
  const toast = useToastState()
  const [now, setNow] = useState(() => Date.now())
  const [errors, setErrors] = useState<string[]>([])

  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [showTemplateForm, setShowTemplateForm] = useState(false)
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft>(EMPTY_TEMPLATE_DRAFT)
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null)
  const [deleteTemplate, setDeleteTemplate] = useState<TaskTemplate | null>(null)

  const [startTemplateId, setStartTemplateId] = useState('')
  const [customName, setCustomName] = useState('')
  const [customSubject, setCustomSubject] = useState('')
  const [plannedMinutes, setPlannedMinutes] = useState('15')

  const [finishingId, setFinishingId] = useState<string | null>(null)
  const [completionDraft, setCompletionDraft] = useState(EMPTY_COMPLETION_DRAFT)
  const [deleteRecordTarget, setDeleteRecordTarget] = useState<TaskRecord | null>(null)

  const records = useLiveQuery(
    async () => (childId ? repo.listTaskRecords(childId) : []),
    [childId],
  )

  useEffect(() => {
    if (!childId) return
    repo
      .listTaskTemplates(childId, true)
      .then(setTemplates)
      .catch(() => setTemplates([]))
  }, [childId, showTemplateForm])

  const openTasks = useMemo(
    () => (records ?? []).filter((r) => r.status !== 'finished'),
    [records],
  )
  const finishedToday = useMemo(
    () => (records ?? []).filter((r) => r.status === 'finished' && r.date === today),
    [records, today],
  )

  /**
   * 近 14 天按学科堆叠的投入分钟。
   * 只算真正填了「实际用时」的记录：没填的不折算、不估算，免得图上的数字是编的。
   */
  const investmentChart = useMemo(() => {
    const start = addDays(today, -13)
    const window = eachDay(start, today)
    const rows = (records ?? [])
      .filter((record) => record.date >= start && record.date <= today)
      .map((record) => ({
        date: record.date,
        key: record.subject.trim() || '未填学科',
        value: record.actualMinutes ?? 0,
      }))
    return buildStacks(rows, window, { restLabel: '其余学科' })
  }, [records, today])

  const anyRunning = openTasks.some((t) => t.timer?.runningSince)

  useEffect(() => {
    if (!anyRunning) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [anyRunning])

  async function startTask(source: { templateId?: string; name?: string; subject?: string }) {
    if (!childId) return
    const tpl = templates.find((t) => t.id === source.templateId)
    if (!tpl && !source.name?.trim()) {
      setErrors(['请选择任务模板，或填写任务名称'])
      return
    }
    if (!tpl && !source.subject?.trim()) {
      setErrors(['请填写学科或任务领域'])
      return
    }
    const minutes = plannedMinutes === '' ? null : Number(plannedMinutes)
    const created = await repo
      .createTaskRecord({
        childId,
        templateId: tpl?.id ?? null,
        date: today,
        name: tpl?.name ?? source.name ?? '',
        subject: tpl?.subject ?? source.subject ?? '',
        difficulty: tpl?.defaultDifficulty ?? 'medium',
        plannedMinutes: tpl ? (tpl.defaultMinutes ?? minutes) : minutes,
        status: 'running',
        timer: { phase: 'focus', accumulatedMs: 0, runningSince: nowISO() },
        barriers: [],
        startMode: null,
        completion: null,
      })
      .catch((err: Error) => err)
    if (created instanceof Error) {
      setErrors(created.message.split('；'))
      return
    }
    setErrors([])
    setCustomName('')
    setCustomSubject('')
    setStartTemplateId('')
    setNow(Date.now())
    toast.show(`「${created.name}」开始计时`)
  }

  async function updateTimer(
    record: TaskRecord,
    action: 'pause' | 'resume' | 'break' | 'finish',
  ) {
    const base: TaskTimer = record.timer ?? {
      phase: 'focus',
      accumulatedMs: 0,
      runningSince: null,
    }
    const background = elapsedMs(base, Date.now())
    if (action === 'pause' || action === 'break' || action === 'finish') {
      const timer: TaskTimer = {
        phase: action === 'break' ? 'break' : 'focus',
        accumulatedMs: action === 'finish' ? 0 : background,
        runningSince: null,
      }
      await repo.updateTaskRecord(record.id, {
        timer,
        status: action === 'finish' ? 'finished' : 'paused',
        actualMinutes: action === 'finish' ? Math.max(0, Math.round(background / 60000)) : record.actualMinutes,
      })
      if (action === 'finish') {
        setCompletionDraft(
          draftFromRecord({
            ...record,
            actualMinutes: Math.max(0, Math.round(background / 60000)),
          }),
        )
        setFinishingId(record.id)
      }
      if (action === 'break') toast.show('休息一下，回来再继续')
      return
    }
    await repo.updateTaskRecord(record.id, {
      timer: { phase: 'focus', accumulatedMs: background, runningSince: nowISO() },
      status: 'running',
    })
    setNow(Date.now())
  }

  async function saveCompletion(record: TaskRecord) {
    const updated = await repo
      .updateTaskRecord(record.id, {
        startMode: completionDraft.startMode,
        completion: completionDraft.completion,
        barriers: completionDraft.barriers,
        actualMinutes:
          completionDraft.actualMinutes === '' ? null : Number(completionDraft.actualMinutes),
        parentNote: completionDraft.parentNote || null,
        status: 'finished',
        timer: null,
      })
      .catch((err: Error) => err)
    if (updated instanceof Error) {
      setErrors(updated.message.split('；'))
      return
    }
    setFinishingId(null)
    setErrors([])
    toast.show(taskFeedback(updated))
  }

  return (
    <>
      <LiveMessage message={toast.message} clear={toast.clear} />
      <PageHeader
        title="学习任务实验室"
        intro="把任务拆小，记下它是怎么开始的、卡在哪里。不按速度和正确率评价孩子。"
      />
      <Errors errors={errors} />

      <Card title="开始一次任务">
        <Notice>
          建议从 10-15 分钟的短时区间起步。孩子可以暂停、休息、结束，不需要一直坐着不动。
        </Notice>
        {templates.length > 0 && (
          <SelectField
            label="从任务模板开始"
            value={startTemplateId}
            placeholder="不选模板，用下面的自定义任务"
            onChange={setStartTemplateId}
            options={templates
              .filter((t) => !t.archived)
              .map((t) => ({
                value: t.id,
                label: `${t.name}（${t.subject}${t.defaultMinutes ? ` · ${t.defaultMinutes} 分钟` : ''}）`,
              }))}
          />
        )}
        {!startTemplateId && (
          <>
            <TextField label="任务名称" value={customName} onChange={setCustomName} />
            <TextField
              label="学科或任务领域"
              value={customSubject}
              onChange={setCustomSubject}
            />
          </>
        )}
        <TextField
          label="这次的短时学习区间（分钟）"
          value={plannedMinutes}
          onChange={setPlannedMinutes}
          hint="到时间不会自动停止，只提醒一下，由家长和孩子决定继续还是休息"
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => startTask({ templateId: startTemplateId, name: customName, subject: customSubject })}
        >
          开始计时
        </button>
      </Card>

      <Card title={`进行中的任务（${openTasks.length}）`}>
        {openTasks.length === 0 ? (
          <EmptyState text="现在没有进行中的任务。" />
        ) : (
          <ul className="list">
            {openTasks.map((record) => {
              const ms = elapsedMs(record.timer, now)
              const over = record.plannedMinutes ? ms >= record.plannedMinutes * 60000 : false
              return (
                <li className="list-item" key={record.id}>
                  <div className="list-item-head">
                    <h3>{record.name}</h3>
                    <span className="tag">
                      {LABELS.status[record.status]}
                      {record.timer?.phase === 'break' ? ' · 休息中' : ''}
                    </span>
                  </div>
                  <p className="muted">
                    {record.subject} · 难度 {LABELS.difficulty[record.difficulty]} · 已计时{' '}
                    <strong>{formatClock(ms)}</strong>
                    {record.plannedMinutes ? ` / 计划 ${record.plannedMinutes} 分钟` : ''}
                  </p>
                  {over && !record.timer?.runningSince && (
                    <Notice>已经到计划的 {record.plannedMinutes} 分钟了，看看是继续一小段还是先休息。</Notice>
                  )}
                  {over && record.timer?.runningSince && (
                    <Notice>
                      已经超过计划的 {record.plannedMinutes} 分钟，想停下来随时可以停。
                    </Notice>
                  )}
                  <div className="row">
                    {record.timer?.runningSince ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => updateTimer(record, 'pause')}
                        >
                          暂停
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => updateTimer(record, 'break')}
                        >
                          休息
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => updateTimer(record, 'resume')}
                      >
                        {record.timer ? '继续' : '开始'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => updateTimer(record, 'finish')}
                    >
                      结束并记录
                    </button>
                  </div>
                  {finishingId === record.id && (
                    <div style={{ marginTop: 12 }}>
                      <h3>结束后的记录</h3>
                      <TaskCompletionFields value={completionDraft} onChange={setCompletionDraft} />
                      <div className="row">
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => saveCompletion(record)}
                        >
                          保存记录
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => setFinishingId(null)}
                        >
                          稍后再记
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card
        title="任务模板与拆分"
        actions={
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              setEditingTemplate(null)
              setTemplateDraft(EMPTY_TEMPLATE_DRAFT)
              setShowTemplateForm((v) => !v)
            }}
          >
            {showTemplateForm ? '收起' : '新建模板'}
          </button>
        }
      >
        {showTemplateForm && (
          <TaskTemplateForm
            value={templateDraft}
            onChange={setTemplateDraft}
            submitLabel={editingTemplate ? '保存修改' : '创建模板'}
            onCancel={() => setShowTemplateForm(false)}
            onSubmit={async () => {
              if (!childId) return
              const payload = {
                childId,
                name: templateDraft.name,
                subject: templateDraft.subject,
                defaultDifficulty: templateDraft.defaultDifficulty,
                defaultMinutes:
                  templateDraft.defaultMinutes === '' ? null : Number(templateDraft.defaultMinutes),
                steps: templateDraft.steps.map((s) => s.trim()).filter(Boolean),
              }
              const check = validateTaskTemplate(payload)
              if (!check.ok) {
                setErrors(check.errors)
                return
              }
              if (editingTemplate) {
                await repo.updateTaskTemplate(editingTemplate.id, payload)
                toast.show('模板已更新')
              } else {
                await repo.createTaskTemplate(payload)
                toast.show('模板已创建')
              }
              setErrors([])
              setShowTemplateForm(false)
              setTemplateDraft(EMPTY_TEMPLATE_DRAFT)
              setEditingTemplate(null)
              setTemplates(await repo.listTaskTemplates(childId, true))
            }}
          />
        )}

        {templates.length === 0 ? (
          <EmptyState text="还没有任务模板。先建一个，比如「口算 20 题」拆成三步。" />
        ) : (
          <ul className="list">
            {templates.map((tpl) => (
              <li className="list-item" key={tpl.id}>
                <div className="list-item-head">
                  <h3>{tpl.name}</h3>
                  <span className="tag">
                    {tpl.subject} · {LABELS.difficulty[tpl.defaultDifficulty]}
                  </span>
                </div>
                {tpl.steps.length > 0 && (
                  <ol className="steps">
                    {tpl.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                )}
                <div className="row">
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => {
                      setStartTemplateId(tpl.id)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                  >
                    用这个任务开始
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      setEditingTemplate(tpl)
                      setTemplateDraft({
                        name: tpl.name,
                        subject: tpl.subject,
                        defaultDifficulty: tpl.defaultDifficulty,
                        defaultMinutes:
                          tpl.defaultMinutes === null || tpl.defaultMinutes === undefined
                            ? ''
                            : `${tpl.defaultMinutes}`,
                        steps: tpl.steps.length > 0 ? tpl.steps : [''],
                      })
                      setShowTemplateForm(true)
                    }}
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={async () => {
                      await repo.updateTaskTemplate(tpl.id, { archived: !tpl.archived })
                      if (childId) setTemplates(await repo.listTaskTemplates(childId, true))
                    }}
                  >
                    {tpl.archived ? '恢复启用' : '归档'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => setDeleteTemplate(tpl)}
                  >
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={`今天已结束的记录（${finishedToday.length}）`}>
        {finishedToday.length === 0 ? (
          <EmptyState text="今天还没有结束的任务记录。" />
        ) : (
          <ul className="list">
            {finishedToday.map((record) => (
              <li className="list-item" key={record.id}>
                <div className="list-item-head">
                  <h3>{record.name}</h3>
                  <span className="tag">
                    {record.completion ? LABELS.completion[record.completion] : '已结束'}
                  </span>
                </div>
                <p className="muted">{taskFeedback(record)}</p>
                <div className="row">
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      setCompletionDraft(draftFromRecord(record))
                      setFinishingId(record.id)
                    }}
                  >
                    补记 / 修改
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => setDeleteRecordTarget(record)}
                  >
                    删除
                  </button>
                </div>
                {finishingId === record.id && (
                  <div style={{ marginTop: 12 }}>
                    <TaskCompletionFields value={completionDraft} onChange={setCompletionDraft} />
                    <div className="row">
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => saveCompletion(record)}
                      >
                        保存修改
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setFinishingId(null)}
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="近 14 天的投入">
        <StackedBars
          title="每天投入的分钟数（按学科堆叠）"
          days={investmentChart.days}
          series={investmentChart.series}
          emptyText="这 14 天还没有填过用时的记录。填了「实际用时」的任务才会出现在这里。"
          note="只统计填了「实际用时」的记录，没填的不折算也不估算。看的是投入分布，不用来评价孩子。"
        />
      </Card>

      <ConfirmDialog
        open={deleteRecordTarget !== null}
        title="删除这条任务记录？"
        description={<p>删除后无法恢复。</p>}
        confirmLabel="删除"
        danger
        onCancel={() => setDeleteRecordTarget(null)}
        onConfirm={async () => {
          if (!deleteRecordTarget) return
          await repo.deleteRecord('taskRecords', deleteRecordTarget.id)
          setDeleteRecordTarget(null)
          toast.show('任务记录已删除')
        }}
      />

      <ConfirmDialog
        open={deleteTemplate !== null}
        title="删除这个任务模板？"
        description={
          <p>
            只会删除模板，已经记录下来的任务历史不受影响。也可以选择「归档」，之后还能恢复。
          </p>
        }
        confirmLabel="删除模板"
        danger
        onCancel={() => setDeleteTemplate(null)}
        onConfirm={async () => {
          if (!deleteTemplate || !childId) return
          await repo.deleteRecord('taskTemplates', deleteTemplate.id)
          setTemplates(await repo.listTaskTemplates(childId, true))
          setDeleteTemplate(null)
          toast.show('模板已删除')
        }}
      />
    </>
  )
}
