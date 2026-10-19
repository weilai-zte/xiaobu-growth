import { useEffect, useMemo, useState } from 'react'
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
  SelectField,
  StepsField,
  TextField,
  useToastState,
} from '../components/ui'
import {
  LABELS,
  RULE_TRIGGER,
  type RoutineRule,
  type RuleStatus,
} from '../db/types'
import { todayKey } from '../lib/date'
import { ruleStatusFeedback } from '../lib/feedback'
import { validateRoutineRule } from '../lib/validate'
import { HABIT_CATEGORIES } from '../lib/habits'
import { PlayPicture } from '../components/PlayCards'

const STATUS_OPTIONS = (['done', 'partial', 'not_done', 'not_applicable'] as const).map(
  (value) => ({ value, label: LABELS.ruleStatus[value] }),
)

interface RuleDraft {
  category: NonNullable<RoutineRule['category']>
  picture: string
  rewardStars: 1 | 2
  description: string
  title: string
  trigger: RoutineRule['trigger']
  customTrigger: string
  steps: string[]
}

const EMPTY_RULE: RuleDraft = {
  category: 'life', picture: 'book', rewardStars: 1, description: '',
  title: '',
  trigger: 'anytime',
  customTrigger: '',
  steps: [''],
}

function RuleCheckRow({ rule, date }: { rule: RoutineRule; date: string }) {
  const { profile } = useApp()
  const childId = profile?.id
  const toast = useToastState()
  const check = useLiveQuery(
    async () => {
      if (!profile?.id) return undefined
      const rows = await repo.listChecks(profile.id, date, date)
      return rows.find((r) => r.ruleId === rule.id)
    },
    [rule.id, date, profile?.id],
  )
  const [status, setStatus] = useState<RuleStatus | null>(null)
  const [note, setNote] = useState('')
  const [minutes, setMinutes] = useState(String(rule.minMinutes ?? ''))
  const [saved, setSaved] = useState<RuleStatus | null>(null)

  useEffect(() => {
    setSaved(check?.status ?? null)
    setNote(check?.parentNote ?? '')
    setMinutes(String(check?.minutes ?? rule.minMinutes ?? ''))
    setStatus(check?.status ?? null)
  }, [check?.updatedAt, check?.status, check?.parentNote])

  return (
    <li>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div className="list-item-head">
          <h3>{rule.title}</h3>
          <span className="tag">{LABELS.ruleTrigger[rule.trigger]}</span>
        </div>
        {rule.steps.length > 0 && (
          <ol className="steps">
            {rule.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        )}
        {status && (
          <p className="muted">{ruleStatusFeedback(rule, status)}</p>
        )}
      </div>
      <div style={{ flexBasis: '100%' }}>
        <LiveMessage message={toast.message} clear={toast.clear} />
        <OptionChips
          legend="今天的情况"
          options={STATUS_OPTIONS}
          value={status}
          onChange={setStatus}
        />
        <TextField
          label="备注（可选）"
          value={note}
          onChange={setNote}
          hint="记下是在哪一步卡住的，比记「没做到」有用"
        />
        {rule.minMinutes && <label>实际运动分钟数<input type="number" min="0" max="600" value={minutes} onChange={e => setMinutes(e.target.value)} /></label>}
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={async () => {
            if (!childId || !status) {
              toast.show('先选一下今天的情况再保存')
              return
            }
            try {
              await repo.setCheck(childId, rule.id, date, status, note || null, rule.minMinutes ? { minutes: Number(minutes) } : {})
              setSaved(status)
              toast.show('今天的执行情况已记录')
            } catch (error) { toast.show(error instanceof Error ? error.message : '没有保存成功，请重试') }
          }}
        >
          {saved ? '更新今天的记录' : '保存今天的记录'}
        </button>
      </div>
    </li>
  )
}

export function Rules() {
  const [saving, setSaving] = useState(false)
  const { profile } = useApp()
  const childId = profile?.id
  const toast = useToastState()
  const [date, setDate] = useState(todayKey())
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<RoutineRule | null>(null)
  const [draft, setDraft] = useState<RuleDraft>(EMPTY_RULE)
  const [errors, setErrors] = useState<string[]>([])
  const [deleteTarget, setDeleteTarget] = useState<RoutineRule | null>(null)

  const rules = useLiveQuery(
    async () => (childId ? repo.listRules(childId) : []),
    [childId],
  )
  const activeRules = useMemo(() => (rules ?? []).filter((r) => r.active), [rules])

  async function saveRule() {
    if (!childId || saving) return
    const payload = {
      category: draft.category, picture: draft.picture, rewardStars: draft.rewardStars, description: draft.description,
      childId,
      title: draft.title,
      trigger: draft.trigger,
      customTrigger: draft.customTrigger || null,
      steps: draft.steps.map((s) => s.trim()).filter(Boolean),
      active: editing?.active ?? true,
    }
    const check = validateRoutineRule(payload)
    if (!check.ok) {
      setErrors(check.errors)
      return
    }
    setSaving(true)
    try { if (editing) {
      await repo.updateRule(editing.id, payload)
      toast.show('规则已更新')
    } else {
      await repo.createRule(payload)
      toast.show('规则已添加')
    }
    setErrors([])
    setDraft(EMPTY_RULE)
    setEditing(null)
    setShowForm(false)
    } catch (error) { setErrors([error instanceof Error ? error.message : '没有保存成功，请重试']) }
    finally { setSaving(false) }
  }

  return (
    <>
      <LiveMessage message={toast.message} clear={toast.clear} />
      <PageHeader
        title="家庭规则与日常流程"
        intro="一次只记今天做到了哪一步。没做到的时候不扣分，也不弹任何提示音。"
      />
      <Errors errors={errors} />

      <Card title="今天的执行情况">
        <InputField
          label="记录的日期"
          type="date"
          value={date}
          max={todayKey()}
          onChange={setDate}
          hint="漏记了可以换日期补录"
        />
        {activeRules.length === 0 ? (
          <EmptyState text="现在没有启用中的规则。" />
        ) : (
          <ul className="check-list">
            {activeRules.map((rule) => (
              <RuleCheckRow key={rule.id} rule={rule} date={date} />
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="规则管理"
        actions={
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              setEditing(null)
              setDraft(EMPTY_RULE)
              setShowForm((v) => !v)
            }}
          >
            {showForm ? '收起' : '添加规则'}
          </button>
        }
      >
        {showForm && (
          <div style={{ marginBottom: 16 }}>
            <SelectField label="打卡分类" value={draft.category} options={HABIT_CATEGORIES.map(c => ({ value: c.key, label: c.label }))} onChange={category => category && setDraft({ ...draft, category })} />
            <SelectField label="完成获得的星星" value={String(draft.rewardStars)} options={[{ value: '1', label: '1颗星' }, { value: '2', label: '2颗星' }]} onChange={value => setDraft({ ...draft, rewardStars: value === '2' ? 2 : 1 })} />
            <fieldset><legend>选择打卡图片</legend><div className="row">{['slippers', 'shirt', 'meal', 'laundry', 'rope', 'bicycle', 'ball', 'book', 'paint', 'bag'].map((picture, i) => <button key={picture} type="button" className="btn" aria-label={`选择${['拖鞋', '衣服', '吃饭', '洗衣', '跳绳', '自行车', '运动', '学习', '绘画', '书包'][i]}图片`} aria-pressed={draft.picture === picture} onClick={() => setDraft({ ...draft, picture })} style={{ width: 100, border: draft.picture === picture ? '3px solid #75609b' : undefined }}><PlayPicture kind={picture} /></button>)}</div></fieldset>
            <TextField label="打卡说明（可选）" value={draft.description} onChange={description => setDraft({ ...draft, description })} hint="用一句话说明怎样算完成，最多200字" />
            <TextField
              label="规则名称"
              value={draft.title}
              onChange={(title) => setDraft({ ...draft, title })}
              hint="写清具体动作，例如「进门后鞋子放进鞋柜」"
            />
            <SelectField
              label="触发时机"
              value={draft.trigger}
              onChange={(trigger) =>
                trigger && setDraft({ ...draft, trigger })
              }
              options={RULE_TRIGGER.map((value) => ({
                value,
                label: LABELS.ruleTrigger[value],
              }))}
            />
            {draft.trigger === 'custom' && (
              <TextField
                label="自定义触发时机"
                value={draft.customTrigger}
                onChange={(customTrigger) => setDraft({ ...draft, customTrigger })}
                hint="例如：放学回家后"
              />
            )}
            <StepsField
              label="执行步骤（视觉清单）"
              steps={draft.steps}
              onChange={(steps) => setDraft({ ...draft, steps })}
              hint="每行一步，孩子可以照着一步步勾掉"
            />
            <div className="row">
              <button type="button" className="btn btn-primary" disabled={saving} onClick={saveRule}>
                {editing ? '保存修改' : '添加规则'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setShowForm(false)
                  setEditing(null)
                  setDraft(EMPTY_RULE)
                }}
              >
                取消
              </button>
            </div>
          </div>
        )}

        <ul className="list">
          {(rules ?? []).map((rule) => (
            <li className="list-item" key={rule.id}>
              <div className="list-item-head">
                <h3>{rule.title}</h3>
                <span className="tag">{rule.active ? '启用中' : '已暂停'}</span>
              </div>
              <p className="muted">
                触发时机：{LABELS.ruleTrigger[rule.trigger]}
                {rule.customTrigger ? `（${rule.customTrigger}）` : ''}
              </p>
              {rule.steps.length > 0 && (
                <ol className="steps">
                  {rule.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              )}
              <div className="row">
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={async () => {
                    await repo.updateRule(rule.id, { active: !rule.active })
                    toast.show(rule.active ? '规则已暂停' : '规则已重新启用')
                  }}
                >
                  {rule.active ? '暂停这条规则' : '重新启用'}
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    setEditing(rule)
                    setDraft({
                      category: rule.category ?? 'life', picture: rule.picture ?? 'book', rewardStars: rule.rewardStars ?? 1, description: rule.description ?? '',
                      title: rule.title,
                      trigger: rule.trigger,
                      customTrigger: rule.customTrigger ?? '',
                      steps: rule.steps.length > 0 ? rule.steps : [''],
                    })
                    setShowForm(true)
                  }}
                >
                  编辑
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={() => setDeleteTarget(rule)}
                >
                  删除
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Notice>
        规则没完成时不会自动扣分，也不会出现羞辱性的提示。记录的作用是看清哪一步最难，然后把它拆得更小。
      </Notice>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除这条规则？"
        description={
          <p>
            这条规则以及它已有的执行记录都会被删除，之后无法恢复。如果只是想暂时不做，用「暂停」就可以。
          </p>
        }
        confirmLabel="删除规则"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget || !childId) return
          const checks = await repo.listChecks(childId)
          for (const c of checks.filter((c) => c.ruleId === deleteTarget.id)) {
            await repo.deleteRecord('routineChecks', c.id)
          }
          await repo.deleteRecord('routineRules', deleteTarget.id)
          setDeleteTarget(null)
          toast.show('规则已删除')
        }}
      />
    </>
  )
}
