import { useMemo, useState } from 'react'
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
  StepsField,
  TextAreaField,
  TextField,
  useToastState,
} from '../components/ui'
import { EXPERIMENT_RESULT, LABELS, type Experiment } from '../db/types'
import { addDays, todayKey } from '../lib/date'
import { buildPeriodCounts } from '../lib/insights'
import { validateExperiment } from '../lib/validate'

interface Draft {
  id: string | null
  problem: string
  hypothesis: string
  adjustment: string
  startDate: string
  endDate: string
  metrics: string[]
  result: Experiment['result']
  parentNote: string
}

function emptyDraft(): Draft {
  return {
    id: null,
    problem: '',
    hypothesis: '',
    adjustment: '',
    startDate: todayKey(),
    endDate: addDays(todayKey(), 6),
    metrics: ['独立启动次数', '需要提醒的次数', '完成情况'],
    result: null,
    parentNote: '',
  }
}

export function Experiments() {
  const { profile } = useApp()
  const childId = profile?.id
  const toast = useToastState()
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [errors, setErrors] = useState<string[]>([])
  const [deleteTarget, setDeleteTarget] = useState<Experiment | null>(null)

  const experiments = useLiveQuery(
    async () => (childId ? repo.listExperiments(childId) : []),
    [childId],
  )
  const observations = useLiveQuery(
    async () => {
      if (!childId) return null
      const [taskRecords, checks, conflicts, strengths, dailyLogs] = await Promise.all([
        repo.listTaskRecords(childId),
        repo.listChecks(childId),
        repo.listConflicts(childId),
        repo.listStrengths(childId),
        repo.listDailyLogs(childId),
      ])
      return { taskRecords, checks, conflicts, strengths, dailyLogs }
    },
    [childId],
  )

  const running = useMemo(
    () => (experiments ?? []).filter((e) => e.endDate >= todayKey()),
    [experiments],
  )
  const past = useMemo(
    () => (experiments ?? []).filter((e) => e.endDate < todayKey()),
    [experiments],
  )

  async function save() {
    if (!childId) return
    const payload = {
      childId,
      problem: draft.problem,
      hypothesis: draft.hypothesis,
      adjustment: draft.adjustment,
      startDate: draft.startDate,
      endDate: draft.endDate,
      metrics: draft.metrics.map((m) => m.trim()).filter(Boolean),
      result: draft.result,
      parentNote: draft.parentNote || null,
    }
    const check = validateExperiment(payload)
    if (!check.ok) {
      setErrors(check.errors)
      return
    }
    if (draft.id) {
      await repo.updateExperiment(draft.id, payload)
      toast.show('实验已更新')
    } else {
      await repo.createExperiment(payload)
      toast.show('实验已创建')
    }
    setErrors([])
    setDraft(emptyDraft())
  }

  function statsFor(exp: Experiment) {
    if (!observations) return null
    return buildPeriodCounts(observations, exp.startDate, exp.endDate)
  }

  const renderExperiment = (exp: Experiment) => {
    const stats = statsFor(exp)
    return (
      <li className="list-item" key={exp.id}>
        <div className="list-item-head">
          <h3>{exp.problem}</h3>
          <span className="tag">
            {exp.startDate} - {exp.endDate}
          </span>
        </div>
        <p className="muted">假设：{exp.hypothesis}</p>
        <p className="muted">调整措施：{exp.adjustment}</p>
        <p className="muted">观察指标：{exp.metrics.join('、')}</p>
        {stats && (
          <div className="metrics" style={{ marginTop: 8 }}>
            <Metric label="观察期内任务记录" value={`${stats.taskRecords} 次`} />
            <Metric label="独立启动" value={`${stats.independentStart} 次`} />
            <Metric label="独立完成" value={`${stats.completedTasks} 次`} />
            <Metric label="部分完成" value={`${stats.partialTasks} 次`} />
            <Metric label="规则执行记录" value={`${stats.ruleChecks} 条`} />
            <Metric label="规则做到" value={`${stats.ruleDone} 条`} />
            <Metric label="冲突记录" value={`${stats.conflicts} 次`} />
            <Metric label="优势事例" value={`${stats.strengths} 件`} />
          </div>
        )}
        <OptionChips
          legend="看到的结果"
          options={EXPERIMENT_RESULT.map((value) => ({
            value,
            label: LABELS.experimentResult[value],
          }))}
          value={exp.result}
          onChange={async (result) => {
            await repo.updateExperiment(exp.id, { result })
            toast.show('结果已记录')
          }}
          hint="只描述观察到的变化，不下因果结论。"
        />
        {exp.parentNote && <p className="muted">家长备注：{exp.parentNote}</p>}
        <div className="row">
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              setDraft({
                id: exp.id,
                problem: exp.problem,
                hypothesis: exp.hypothesis,
                adjustment: exp.adjustment,
                startDate: exp.startDate,
                endDate: exp.endDate,
                metrics: exp.metrics.length > 0 ? exp.metrics : [''],
                result: exp.result,
                parentNote: exp.parentNote ?? '',
              })
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          >
            修改
          </button>
          <button
            type="button"
            className="btn btn-sm btn-danger"
            onClick={() => setDeleteTarget(exp)}
          >
            删除
          </button>
        </div>
      </li>
    )
  }

  return (
    <>
      <LiveMessage message={toast.message} clear={toast.clear} />
      <PageHeader
        title="家庭改进实验"
        intro="一次只试一件事，先写下假设，一周后看看记录里有什么变化。"
      />
      <Errors errors={errors} />

      <Card title={draft.id ? '修改实验' : '新建一个实验'}>
        <TextField
          label="问题"
          value={draft.problem}
          onChange={(problem) => setDraft({ ...draft, problem })}
          hint="例如：晚上八点后的学习任务很难启动"
        />
        <TextAreaField
          label="假设"
          value={draft.hypothesis}
          onChange={(hypothesis) => setDraft({ ...draft, hypothesis })}
          rows={2}
          hint="例如：把任务拆成更小的步骤，可能减少启动困难"
        />
        <TextAreaField
          label="调整措施"
          value={draft.adjustment}
          onChange={(adjustment) => setDraft({ ...draft, adjustment })}
          rows={2}
          hint="例如：连续一周每次只给一个明确指令"
        />
        <InputField
          label="开始日期"
          type="date"
          value={draft.startDate}
          max={draft.endDate}
          onChange={(startDate) => setDraft({ ...draft, startDate })}
        />
        <InputField
          label="结束日期"
          type="date"
          value={draft.endDate}
          min={draft.startDate}
          onChange={(endDate) => setDraft({ ...draft, endDate })}
        />
        <StepsField
          label="观察指标"
          steps={draft.metrics}
          onChange={(metrics) => setDraft({ ...draft, metrics })}
          hint="每行一个指标，例如「独立启动次数」，页面上会自动带出对应计数"
        />
        <OptionChips
          legend="目前看到的结果（可先不填）"
          options={EXPERIMENT_RESULT.map((value) => ({
            value,
            label: LABELS.experimentResult[value],
          }))}
          value={draft.result}
          onChange={(result) => setDraft({ ...draft, result })}
        />
        <TextAreaField
          label="家长备注（可选）"
          value={draft.parentNote}
          onChange={(parentNote) => setDraft({ ...draft, parentNote })}
          rows={2}
        />
        <div className="row">
          <button type="button" className="btn btn-primary" onClick={save}>
            {draft.id ? '保存修改' : '创建实验'}
          </button>
          {draft.id && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setDraft(emptyDraft())}
            >
              取消修改
            </button>
          )}
        </div>
      </Card>

      <Card title={`进行中（${running.length}）`}>
        {running.length === 0 ? (
          <EmptyState text="现在没有进行中的实验。" />
        ) : (
          <ul className="list">{running.map(renderExperiment)}</ul>
        )}
      </Card>

      <Card title={`已结束（${past.length}）`}>
        {past.length === 0 ? (
          <EmptyState text="还没有结束的实验。" />
        ) : (
          <ul className="list">{past.map(renderExperiment)}</ul>
        )}
      </Card>

      <Notice variant="warn">
        医疗相关的问题只做记录和就医沟通，不在这里做诊断或治疗实验。实验结论只描述观察到的变化，不宣称因果关系。
      </Notice>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除这个实验？"
        description={<p>只会删除实验记录，其他数据不受影响。</p>}
        confirmLabel="删除"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return
          await repo.deleteRecord('experiments', deleteTarget.id)
          setDeleteTarget(null)
          toast.show('实验已删除')
        }}
      />
    </>
  )
}
