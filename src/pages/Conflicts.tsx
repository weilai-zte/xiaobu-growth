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
  Notice,
  OptionChips,
  PageHeader,
  TextAreaField,
  TextField,
  useToastState,
} from '../components/ui'
import {
  CONFLICT_TRIGGER,
  LABELS,
  type ConflictLog,
  type ConflictTrigger,
  type RepairState,
} from '../db/types'
import { formatDateTime, fromLocalInputValue, toLocalInputValue } from '../lib/date'
import { validateConflictLog } from '../lib/validate'

interface Draft {
  id: string | null
  occurredAt: string
  trigger: ConflictTrigger | null
  triggerOther: string
  childDescription: string
  otherDescription: string
  parentResponse: string
  resolution: string
  nextIdea: string
  parentNagging: boolean | null
  parentComparison: boolean | null
  repaired: RepairState | null
}

function emptyDraft(): Draft {
  return {
    id: null,
    occurredAt: toLocalInputValue(new Date().toISOString()),
    trigger: null,
    triggerOther: '',
    childDescription: '',
    otherDescription: '',
    parentResponse: '',
    resolution: '',
    nextIdea: '',
    parentNagging: null,
    parentComparison: null,
    repaired: null,
  }
}

const YES_NO = [
  { value: 'yes', label: '是' },
  { value: 'no', label: '否' },
] as const

export function Conflicts() {
  const { profile } = useApp()
  const childId = profile?.id
  const toast = useToastState()
  const [showForm, setShowForm] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [errors, setErrors] = useState<string[]>([])
  const [deleteTarget, setDeleteTarget] = useState<ConflictLog | null>(null)

  const conflicts = useLiveQuery(
    async () => (childId ? repo.listConflicts(childId) : []),
    [childId],
  )

  const summary = useMemo(() => {
    const rows = conflicts ?? []
    return {
      total: rows.length,
      nagging: rows.filter((r) => r.parentNagging === true).length,
      comparison: rows.filter((r) => r.parentComparison === true).length,
      repaired: rows.filter((r) => r.repaired === 'yes').length,
    }
  }, [conflicts])

  async function save() {
    if (!childId) return
    const payload = {
      childId,
      occurredAt: draft.occurredAt ? fromLocalInputValue(draft.occurredAt) : '',
      trigger: draft.trigger,
      triggerOther: draft.triggerOther || null,
      childDescription: draft.childDescription,
      otherDescription: draft.otherDescription || null,
      parentResponse: draft.parentResponse,
      resolution: draft.resolution,
      nextIdea: draft.nextIdea,
      parentNagging: draft.parentNagging,
      parentComparison: draft.parentComparison,
      repaired: draft.repaired,
    }
    const check = validateConflictLog(payload)
    if (!check.ok) {
      setErrors(check.errors)
      return
    }
    if (draft.id) {
      await repo.updateConflict(draft.id, payload)
      toast.show('这条复盘已更新')
    } else {
      await repo.createConflict(payload)
      toast.show('这条复盘已保存')
    }
    setErrors([])
    setDraft(emptyDraft())
    setShowForm(false)
  }

  return (
    <>
      <LiveMessage message={toast.message} clear={toast.clear} />
      <PageHeader
        title="家庭冲突复盘"
        intro="先把两个人各自的说法记下来，不急着判断谁对谁错。这些内容默认不展示给孩子。"
      />
      <Errors errors={errors} />

      <Card
        title={draft.id ? '修改这条复盘' : '记录一次冲突'}
        actions={
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              setDraft(emptyDraft())
              setShowForm((v) => !v)
            }}
          >
            {showForm ? '收起' : '新增记录'}
          </button>
        }
      >
        {showForm ? (
          <div>
            <InputField
              label="发生时间"
              type="datetime"
              value={draft.occurredAt}
              onChange={(occurredAt) => setDraft({ ...draft, occurredAt })}
            />
            <OptionChips
              legend="触发情境"
              options={CONFLICT_TRIGGER.map((value) => ({
                value,
                label: LABELS.conflictTrigger[value],
              }))}
              value={draft.trigger}
              onChange={(trigger) => setDraft({ ...draft, trigger })}
            />
            {draft.trigger === 'other' && (
              <TextField
                label="其他情境说明"
                value={draft.triggerOther}
                onChange={(triggerOther) => setDraft({ ...draft, triggerOther })}
              />
            )}
            <TextAreaField
              label="孩子是怎么描述这件事的？"
              value={draft.childDescription}
              onChange={(childDescription) => setDraft({ ...draft, childDescription })}
              hint="尽量用孩子自己的话，可以带情绪"
            />
            <TextAreaField
              label="另一方是怎么描述的？（可选）"
              value={draft.otherDescription}
              onChange={(otherDescription) => setDraft({ ...draft, otherDescription })}
            />
            <TextAreaField
              label="家长当时是怎么处理的？"
              value={draft.parentResponse}
              onChange={(parentResponse) => setDraft({ ...draft, parentResponse })}
            />
            <TextAreaField
              label="最后是怎么解决的？"
              value={draft.resolution}
              onChange={(resolution) => setDraft({ ...draft, resolution })}
            />
            <TextAreaField
              label="下次可以尝试什么不同的方法？"
              value={draft.nextIdea}
              onChange={(nextIdea) => setDraft({ ...draft, nextIdea })}
            />
            <OptionChips
              legend="家长自己当时有没有连续催促？"
              options={YES_NO.map((o) => ({
                value: o.value,
                label: o.label,
              }))}
              value={draft.parentNagging === null ? null : draft.parentNagging ? 'yes' : 'no'}
              onChange={(value) => setDraft({ ...draft, parentNagging: value === 'yes' })}
              hint="只做记录，不评判。"
            />
            <OptionChips
              legend="当时有没有出现兄弟之间的比较？"
              options={YES_NO.map((o) => ({ value: o.value, label: o.label }))}
              value={
                draft.parentComparison === null ? null : draft.parentComparison ? 'yes' : 'no'
              }
              onChange={(value) => setDraft({ ...draft, parentComparison: value === 'yes' })}
            />
            <OptionChips
              legend="这次冲突后来修复了吗？"
              options={(['yes', 'partly', 'no'] as const).map((value) => ({
                value,
                label: LABELS.repair[value],
              }))}
              value={draft.repaired}
              onChange={(repaired) => setDraft({ ...draft, repaired })}
            />
            <div className="row">
              <button type="button" className="btn btn-primary" onClick={save}>
                保存复盘
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setShowForm(false)
                  setDraft(emptyDraft())
                  setErrors([])
                }}
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <p className="muted">
            记录的用途是找出反复出现的情境，不是为了判定谁有问题。
          </p>
        )}
      </Card>

      <Card title="最近的记录">
        <div className="metrics">
          <div className="metric">
            <span className="metric-label">记录次数</span>
            <span className="metric-value">{summary.total}</span>
          </div>
          <div className="metric">
            <span className="metric-label">家长记录到连续催促</span>
            <span className="metric-value">{summary.nagging} 次</span>
          </div>
          <div className="metric">
            <span className="metric-label">出现比较</span>
            <span className="metric-value">{summary.comparison} 次</span>
          </div>
          <div className="metric">
            <span className="metric-label">已经修复</span>
            <span className="metric-value">{summary.repaired} 次</span>
          </div>
        </div>
        {(conflicts ?? []).length === 0 ? (
          <EmptyState text="还没有记录。不必每次都记，记下反复出现的那种就够。" />
        ) : (
          <ul className="list" style={{ marginTop: 12 }}>
            {(conflicts ?? []).map((row) => (
              <li className="list-item" key={row.id}>
                <div className="list-item-head">
                  <h3>{formatDateTime(row.occurredAt)}</h3>
                  <span className="tag">{LABELS.conflictTrigger[row.trigger]}</span>
                </div>
                <p className="muted">孩子的说法：{row.childDescription}</p>
                {row.otherDescription && (
                  <p className="muted">另一方的说法：{row.otherDescription}</p>
                )}
                <p className="muted">家长的处理：{row.parentResponse}</p>
                <p className="muted">如何解决：{row.resolution}</p>
                <p className="muted">下次可以试试：{row.nextIdea}</p>
                <p className="muted">
                  {row.parentNagging === true ? '当时有过连续催促' : '没有连续催促'}
                  {' · '}
                  {row.parentComparison === true ? '出现过比较' : '没有出现比较'}
                  {row.repaired ? ` · ${LABELS.repair[row.repaired]}` : ''}
                </p>
                <div className="row">
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      setDraft({
                        id: row.id,
                        occurredAt: toLocalInputValue(row.occurredAt),
                        trigger: row.trigger,
                        triggerOther: row.triggerOther ?? '',
                        childDescription: row.childDescription,
                        otherDescription: row.otherDescription ?? '',
                        parentResponse: row.parentResponse,
                        resolution: row.resolution,
                        nextIdea: row.nextIdea,
                        parentNagging: row.parentNagging,
                        parentComparison: row.parentComparison,
                        repaired: row.repaired,
                      })
                      setShowForm(true)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                  >
                    修改
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => setDeleteTarget(row)}
                  >
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Notice variant="warn">
        这里不会自动判定谁对谁错，也不会把孩子标记成问题制造者。记录只服务于「下次换什么办法」。
      </Notice>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除这条冲突复盘？"
        description={<p>删除后无法恢复。</p>}
        confirmLabel="删除"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return
          await repo.deleteRecord('conflictLogs', deleteTarget.id)
          setDeleteTarget(null)
          toast.show('这条复盘已删除')
        }}
      />
    </>
  )
}
