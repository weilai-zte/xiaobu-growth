import { Card, NumberField, OptionChips, SelectField, StepsField, TextAreaField, TextField } from './ui'
import {
  BARRIERS,
  COMPLETION,
  DIFFICULTY,
  LABELS,
  START_MODE,
  type Barrier,
  type Completion,
  type Difficulty,
  type StartMode,
  type TaskRecord,
} from '../db/types'

export interface CompletionDraft {
  startMode: StartMode | null
  completion: Completion | null
  barriers: Barrier[]
  actualMinutes: string
  parentNote: string
}

export const EMPTY_COMPLETION_DRAFT: CompletionDraft = {
  startMode: null,
  completion: null,
  barriers: [],
  actualMinutes: '',
  parentNote: '',
}

export function draftFromRecord(record: TaskRecord): CompletionDraft {
  return {
    startMode: record.startMode,
    completion: record.completion,
    barriers: record.barriers,
    actualMinutes: record.actualMinutes === null ? '' : `${record.actualMinutes}`,
    parentNote: record.parentNote ?? '',
  }
}

const START_OPTIONS = START_MODE.map((value) => ({ value, label: LABELS.startMode[value] }))
const COMPLETION_OPTIONS = COMPLETION.map((value) => ({
  value,
  label: LABELS.completion[value],
}))
const BARRIER_OPTIONS = BARRIERS.map((value) => ({ value, label: LABELS.barrier[value] }))

export function TaskCompletionFields({
  value,
  onChange,
  showNote = true,
}: {
  value: CompletionDraft
  onChange: (value: CompletionDraft) => void
  showNote?: boolean
}) {
  return (
    <>
      <OptionChips
        legend="这次是怎么开始的？"
        options={START_OPTIONS}
        value={value.startMode}
        onChange={(startMode) => onChange({ ...value, startMode })}
      />
      <OptionChips
        legend="完成状态"
        options={COMPLETION_OPTIONS}
        value={value.completion}
        onChange={(completion) => onChange({ ...value, completion })}
      />
      <fieldset>
        <legend>主要障碍（可多选）</legend>
        <div className="chips">
          {BARRIER_OPTIONS.map((option) => {
            const checked = value.barriers.includes(option.value)
            return (
              <label className="chip" key={option.value}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    onChange({
                      ...value,
                      barriers: checked
                        ? value.barriers.filter((b) => b !== option.value)
                        : [...value.barriers, option.value],
                    })
                  }
                />
                {option.label}
              </label>
            )
          })}
        </div>
        <span className="hint">记录困难是为了下次换办法，不作为评价孩子的依据。</span>
      </fieldset>
      <NumberField
        label="实际用时（分钟，可选）"
        value={value.actualMinutes}
        min={0}
        max={600}
        onChange={(actualMinutes) => onChange({ ...value, actualMinutes })}
      />
      {showNote && (
        <TextAreaField
          label="家长备注（可选）"
          value={value.parentNote}
          onChange={(parentNote) => onChange({ ...value, parentNote })}
          rows={2}
        />
      )}
    </>
  )
}

export interface TemplateDraft {
  name: string
  subject: string
  defaultDifficulty: Difficulty
  defaultMinutes: string
  steps: string[]
}

export const EMPTY_TEMPLATE_DRAFT: TemplateDraft = {
  name: '',
  subject: '',
  defaultDifficulty: 'medium',
  defaultMinutes: '15',
  steps: [''],
}

export function TaskTemplateForm({
  value,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  value: TemplateDraft
  onChange: (value: TemplateDraft) => void
  onSubmit: () => void
  onCancel: () => void
  submitLabel: string
}) {
  return (
    <Card title="任务设置">
      <TextField
        label="任务名称"
        value={value.name}
        onChange={(name) => onChange({ ...value, name })}
        hint="越具体越好，例如「语文听写第 3 课 8 个词」"
      />
      <TextField
        label="学科或任务领域"
        value={value.subject}
        onChange={(subject) => onChange({ ...value, subject })}
        hint="例如：语文 / 口算 / 整理书包"
      />
      <SelectField
        label="任务难度"
        value={value.defaultDifficulty}
        onChange={(v) => v && onChange({ ...value, defaultDifficulty: v })}
        options={DIFFICULTY.map((d) => ({ value: d, label: LABELS.difficulty[d] }))}
      />
      <NumberField
        label="建议的短时学习区间（分钟）"
        value={value.defaultMinutes}
        min={5}
        max={60}
        onChange={(defaultMinutes) => onChange({ ...value, defaultMinutes })}
        hint="建议从 10-15 分钟起步，孩子能坐住多久就设多久，之后可以调整。"
      />
      <StepsField
        label="把它拆成几步"
        steps={value.steps}
        onChange={(steps) => onChange({ ...value, steps })}
        hint="每行一个步骤，例如「拿出课本」「读一遍词语」「写第一行」"
      />
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={onSubmit}>
          {submitLabel}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          取消
        </button>
      </div>
    </Card>
  )
}
