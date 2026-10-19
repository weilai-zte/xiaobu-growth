import { useState } from 'react'
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
  LABELS,
  STRENGTH_CATEGORY,
  type StrengthCategory,
  type StrengthMoment,
} from '../db/types'
import { formatDay, todayKey } from '../lib/date'
import { validateStrengthMoment } from '../lib/validate'

interface Draft {
  id: string | null
  date: string
  category: StrengthCategory | null
  categoryOther: string
  event: string
  childAction: string
  outcome: string
  childFeeling: string
}

function emptyDraft(): Draft {
  return {
    id: null,
    date: todayKey(),
    category: null,
    categoryOther: '',
    event: '',
    childAction: '',
    outcome: '',
    childFeeling: '',
  }
}

export function Strengths() {
  const { profile } = useApp()
  const childId = profile?.id
  const toast = useToastState()
  const [showForm, setShowForm] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [errors, setErrors] = useState<string[]>([])
  const [deleteTarget, setDeleteTarget] = useState<StrengthMoment | null>(null)

  const moments = useLiveQuery(
    async () => (childId ? repo.listStrengths(childId) : []),
    [childId],
  )

  async function save() {
    if (!childId) return
    const payload = {
      childId,
      date: draft.date,
      category: draft.category,
      categoryOther: draft.categoryOther || null,
      event: draft.event,
      childAction: draft.childAction,
      outcome: draft.outcome,
      childFeeling: draft.childFeeling || null,
    }
    const check = validateStrengthMoment(payload)
    if (!check.ok) {
      setErrors(check.errors)
      return
    }
    if (draft.id) {
      await repo.updateStrength(draft.id, payload)
      toast.show('这条记录已更新')
    } else {
      await repo.createStrength(payload)
      toast.show('这条优势事例已保存')
    }
    setErrors([])
    setDraft(emptyDraft())
    setShowForm(false)
  }

  return (
    <>
      <LiveMessage message={toast.message} clear={toast.clear} />
      <PageHeader
        title="优势与成长事例"
        intro="记下具体发生的事，而不是给孩子贴「聪明」「乖」这样的标签。"
      />
      <Errors errors={errors} />

      <Card
        title={draft.id ? '修改这条事例' : '记录一件优势事例'}
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
              label="日期"
              type="date"
              value={draft.date}
              max={todayKey()}
              onChange={(date) => setDraft({ ...draft, date })}
            />
            <OptionChips
              legend="优势类别"
              options={STRENGTH_CATEGORY.map((value) => ({
                value,
                label: LABELS.strength[value],
              }))}
              value={draft.category}
              onChange={(category) => setDraft({ ...draft, category })}
            />
            {draft.category === 'other' && (
              <TextField
                label="其他优势的说明"
                value={draft.categoryOther}
                onChange={(categoryOther) => setDraft({ ...draft, categoryOther })}
              />
            )}
            <TextAreaField
              label="具体发生了什么？"
              value={draft.event}
              onChange={(event) => setDraft({ ...draft, event })}
              placeholder="例如：弟弟摔倒后，他先把弟弟扶起来，再去拿创可贴。"
            />
            <TextAreaField
              label="孩子做了什么？"
              value={draft.childAction}
              onChange={(childAction) => setDraft({ ...draft, childAction })}
            />
            <TextAreaField
              label="结果如何？"
              value={draft.outcome}
              onChange={(outcome) => setDraft({ ...draft, outcome })}
            />
            <TextAreaField
              label="孩子自己的感受（可选）"
              value={draft.childFeeling}
              onChange={(childFeeling) => setDraft({ ...draft, childFeeling })}
              hint="可以问他一句：刚才那件事你感觉怎么样？"
            />
            <div className="row">
              <button type="button" className="btn btn-primary" onClick={save}>
                保存记录
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
          <p className="muted">孩子做得好的一面经常被忽略，这里专门给它留位置。</p>
        )}
      </Card>

      <Card title={`已记录 ${(moments ?? []).length} 件事例`}>
        {(moments ?? []).length === 0 ? (
          <EmptyState text="还没有记录。今天先找一件具体的小事记下来。" />
        ) : (
          <ul className="list">
            {(moments ?? []).map((moment) => (
              <li className="list-item" key={moment.id}>
                <div className="list-item-head">
                  <h3>{formatDay(moment.date)}</h3>
                  <span className="tag tag-soft">
                    {moment.category === 'other' && moment.categoryOther
                      ? moment.categoryOther
                      : LABELS.strength[moment.category]}
                  </span>
                </div>
                <p>{moment.event}</p>
                <p className="muted">他做了什么：{moment.childAction}</p>
                <p className="muted">结果：{moment.outcome}</p>
                {moment.childFeeling && (
                  <p className="muted">他自己的感受：{moment.childFeeling}</p>
                )}
                <div className="row">
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      setDraft({
                        id: moment.id,
                        date: moment.date,
                        category: moment.category,
                        categoryOther: moment.categoryOther ?? '',
                        event: moment.event,
                        childAction: moment.childAction,
                        outcome: moment.outcome,
                        childFeeling: moment.childFeeling ?? '',
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
                    onClick={() => setDeleteTarget(moment)}
                  >
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Notice>
        优势事例会在每周复盘里按类别汇总，用来平衡家长平时更容易注意到的困难。
      </Notice>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除这条事例？"
        description={<p>删除后无法恢复。</p>}
        confirmLabel="删除"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return
          await repo.deleteRecord('strengthMoments', deleteTarget.id)
          setDeleteTarget(null)
          toast.show('这条事例已删除')
        }}
      />
    </>
  )
}
