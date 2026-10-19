import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { repo } from '../db/repo'
import { useApp } from '../app/AppProvider'
import { useToday } from '../app/hooks'
import {
  Card,
  Errors,
  EmptyState,
  LiveMessage,
  Notice,
  SelectField,
  TextField,
  useToastState,
} from '../components/ui'
import { IconBook, IconChart, IconMoon, ProgressRing } from '../components/icons'
import { LABELS, type TaskRecord } from '../db/types'
import { todayKey, relativeDayLabel } from '../lib/date'
import { todayFeedback, taskFeedback } from '../lib/feedback'
import {
  EMPTY_COMPLETION_DRAFT,
  TaskCompletionFields,
  draftFromRecord,
  type CompletionDraft,
} from '../components/TaskForms'

const MAX_HIGHLIGHT = 5

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 11) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

/** 完成得怎么样，用颜色说，不用措辞说 */
function taskTagClass(task: TaskRecord): string {
  if (task.completion === 'independent') return 'tag tag-success'
  if (task.completion === 'partial') return 'tag tag-warn'
  return task.completion ? 'tag' : 'tag tag-soft'
}

export function Today() {
  const { profile } = useApp()
  const { childId, date, tasks, rules, checks } = useToday()
  const templates = useLiveQuery(
    () => (childId ? repo.listTaskTemplates(childId) : Promise.resolve([])),
    [childId],
  )
  const strengths = useLiveQuery(
    () => (childId ? repo.listStrengths(childId, date, date) : Promise.resolve([])),
    [childId, date],
  )
  const toast = useToastState()
  const [finishing, setFinishing] = useState<string | null>(null)
  const [draft, setDraft] = useState<CompletionDraft>(EMPTY_COMPLETION_DRAFT)
  const [errors, setErrors] = useState<string[]>([])

  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState('')
  const [addTemplateId, setAddTemplateId] = useState('')
  const [addSubject, setAddSubject] = useState('')

  const checkByRule = useMemo(
    () => new Map(checks.map((c) => [c.ruleId, c])),
    [checks],
  )
  const bedtimeRules = rules.filter((r) => r.active && r.trigger === 'bedtime')

  const feedback = todayFeedback({
    profileName: profile?.nickname || profile?.name,
    tasks,
    checks: checks.flatMap((check) => {
      const rule = rules.find((r) => r.id === check.ruleId)
      return rule ? [{ check, rule }] : []
    }),
    strengths: strengths ?? [],
  })

  const openTasks = tasks.filter((t) => !t.completion)
  const doneCount = tasks.filter((t) => t.completion === 'independent').length
  const partialCount = tasks.filter((t) => t.completion === 'partial').length
  const tonightDone = bedtimeRules.filter(
    (r) => checkByRule.get(r.id)?.status === 'done',
  ).length

  function startFinish(task: TaskRecord) {
    setFinishing(task.id)
    setDraft(draftFromRecord(task))
    setErrors([])
  }

  async function saveFinish(task: TaskRecord) {
    const result = await repo
      .updateTaskRecord(task.id, {
        startMode: draft.startMode,
        completion: draft.completion,
        barriers: draft.barriers,
        actualMinutes: draft.actualMinutes === '' ? null : Number(draft.actualMinutes),
        parentNote: draft.parentNote || null,
        status: 'finished',
      })
      .catch((err: Error) => err)
    if (result instanceof Error) {
      setErrors(result.message.split('；'))
      return
    }
    setFinishing(null)
    toast.show(taskFeedback(result))
  }

  return (
    <>
      <LiveMessage message={toast.message} clear={toast.clear} />
      <section className="hero rise-in">
        <div className="hero-row">
          <div>
            <h1 className="hero-title">
              {greeting()}，{profile?.nickname || profile?.name || ''}
            </h1>
            <p className="hero-sub">
              {relativeDayLabel(date)}
              {todayKey() === date ? ' · 只看最重要的几件事' : ''}
            </p>
          </div>
          <ProgressRing
            value={tasks.length === 0 ? 0 : doneCount / tasks.length}
            tone={tasks.length > 0 && doneCount === tasks.length ? 'success' : 'accent'}
            label={tasks.length === 0 ? '—' : `${doneCount}/${tasks.length}`}
          />
        </div>
        <p className="hero-feedback" id="feedback">
          {feedback}
        </p>
        <div className="hero-stats">
          <div className="hero-stat">
            <b>{doneCount}</b>
            <span>独立完成</span>
          </div>
          <div className="hero-stat">
            <b>{partialCount}</b>
            <span>部分完成</span>
          </div>
          <div className="hero-stat">
            <b>{openTasks.length}</b>
            <span>待开始</span>
          </div>
        </div>
        <p className="muted hero-note">
          这些数字只用来看清过程，不做排名，也不与其他孩子比较。
        </p>
      </section>

      <Card
        title={`今日任务（${openTasks.length} 项待开始）`}
        actions={
          <button type="button" className="btn btn-sm" onClick={() => setAddOpen((v) => !v)}>
            {addOpen ? '收起' : '添加任务'}
          </button>
        }
      >
        {errors.length > 0 ? <Errors errors={errors} /> : null}
        {addOpen && (
          <div>
            {(templates ?? []).length > 0 && (
              <SelectField
                label="从任务模板里选一个"
                value={addTemplateId}
                placeholder="不选，直接填下面"
                onChange={(value) => {
                  setAddTemplateId(value)
                  const tpl = (templates ?? []).find((t) => t.id === value)
                  if (tpl) {
                    setAddName(tpl.name)
                    setAddSubject(tpl.subject)
                  }
                }}
                options={(templates ?? []).map((t) => ({ value: t.id, label: t.name }))}
              />
            )}
            <TextField label="任务名称" value={addName} onChange={setAddName} />
            <TextField
              label="学科或任务领域"
              value={addSubject}
              onChange={setAddSubject}
              hint="例如：语文、口算、整理书包"
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={async () => {
                if (!childId) return
                const tpl = (templates ?? []).find((t) => t.id === addTemplateId)
                const result = await repo
                  .createTaskRecord({
                    childId,
                    templateId: tpl?.id ?? null,
                    date,
                    name: addName,
                    subject: addSubject,
                    difficulty: tpl?.defaultDifficulty ?? 'medium',
                    plannedMinutes: tpl?.defaultMinutes ?? null,
                    status: 'planned',
                  })
                  .catch((err: Error) => err)
                if (result instanceof Error) {
                  setErrors(result.message.split('；'))
                  return
                }
                setAddName('')
                setAddSubject('')
                setAddTemplateId('')
                setAddOpen(false)
                setErrors([])
                toast.show('任务已加入今天')
              }}
            >
              加入今天
            </button>
          </div>
        )}

        {tasks.length === 0 ? (
          <EmptyState text="今天还没有任务。可以先加一件 10 分钟就能开始的小事。" />
        ) : (
          <ul className="list">
            {tasks.slice(0, MAX_HIGHLIGHT).map((task) => (
              <li className="list-item" key={task.id}>
                <div className="list-item-head">
                  <h3>{task.name}</h3>
                  <span className={taskTagClass(task)}>
                    {task.completion
                      ? LABELS.completion[task.completion]
                      : LABELS.status[task.status]}
                  </span>
                </div>
                <p className="muted">
                  {task.subject} · 难度 {LABELS.difficulty[task.difficulty]}
                  {task.plannedMinutes ? ` · 计划 ${task.plannedMinutes} 分钟` : ''}
                  {task.startMode ? ` · ${LABELS.startMode[task.startMode]}` : ''}
                </p>
                {task.barriers.length > 0 && (
                  <p className="muted">
                    遇到的困难：{task.barriers.map((b) => LABELS.barrier[b]).join('、')}
                  </p>
                )}
                {finishing === task.id ? (
                  <div>
                    <TaskCompletionFields value={draft} onChange={setDraft} />
                    <div className="row">
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => saveFinish(task)}
                      >
                        保存记录
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setFinishing(null)}
                      >
                        先不记
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="row">
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => startFinish(task)}
                    >
                      记完成情况
                    </button>
                    {task.status !== 'finished' && (
                      <Link className="btn btn-sm" to="/study">
                        去计时
                      </Link>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {tasks.length > MAX_HIGHLIGHT && (
          <p className="muted">另外还有 {tasks.length - MAX_HIGHLIGHT} 项，需要时再去学习页处理。</p>
        )}
      </Card>

      {bedtimeRules.length > 0 && (
        <Card title="睡前准备提醒">
          <p className="muted">
            {tonightDone === bedtimeRules.length
              ? '睡前的事情今天都已经记上了。'
              : `今天有 ${bedtimeRules.length - tonightDone} 项睡前准备还没记录，睡前十分钟一起过一遍。`}
          </p>
          <ul className="list">
            {bedtimeRules.map((rule) => (
              <li className="list-item" key={rule.id}>
                <div className="list-item-head">
                  <h3>{rule.title}</h3>
                  <span className="tag tag-soft">
                    {checkByRule.get(rule.id)
                      ? LABELS.ruleStatus[checkByRule.get(rule.id)!.status]
                      : '还没记录'}
                  </span>
                </div>
                {rule.steps.length > 0 && (
                  <ol className="steps">
                    {rule.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ul>
          <Link className="btn btn-sm" to="/rules">
            去记录睡前准备
          </Link>
        </Card>
      )}

      <Card title="快速进入">
        <div className="quick-links">
          <Link className="quick-link" to="/sleep">
            <span className="quick-link-icon" aria-hidden="true">
              <IconMoon size={19} />
            </span>
            <strong>睡眠与身体</strong>
            <span>补录昨晚或今天早上</span>
          </Link>
          <Link className="quick-link" to="/study">
            <span className="quick-link-icon" aria-hidden="true">
              <IconBook size={19} />
            </span>
            <strong>学习任务</strong>
            <span>短时区间与计时</span>
          </Link>
          <Link className="quick-link" to="/weekly">
            <span className="quick-link-icon" aria-hidden="true">
              <IconChart size={19} />
            </span>
            <strong>每周复盘</strong>
            <span>看这周的事实与实验</span>
          </Link>
        </div>
      </Card>

      <Notice variant="warn">
        记录健康信息只用于观察与就医沟通，这里不做诊断、不给用药建议。
      </Notice>
    </>
  )
}
