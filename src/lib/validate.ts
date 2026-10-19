import { isClockTime, isDayKey, dayKeyToDate, diffDays } from './date'
import { HABIT_PLAN } from './habits'
import {
  BARRIERS,
  type ChildProfile,
  CONFLICT_TRIGGER,
  DIFFICULTY,
  EXPERIMENT_RESULT,
  REPAIR_STATE,
  RULE_STATUS,
  RULE_TRIGGER,
  START_MODE,
  COMPLETION,
  STRENGTH_CATEGORY,
  type Barrier,
  type ConflictLog,
  type DailyLog,
  type Experiment,
  type RoutineRule,
  type RoutineCheck,
  type StrengthMoment,
  type TaskRecord,
  type TaskTemplate,
  type WeeklyReview,
} from '../db/types'

export interface ValidationResult {
  ok: boolean
  errors: string[]
}

/** 表单草稿：所有字段可选，且允许显式传 null（表示“清空这个字段”） */
export type Draft<T> = { [K in keyof T]?: T[K] | null }

function finish(errors: string[]): ValidationResult {
  return { ok: errors.length === 0, errors }
}

function requiredText(value: unknown, label: string, max = 200): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return `${label}不能为空`
  }
  if (value.trim().length > max) return `${label}最多 ${max} 个字`
  return null
}

function optionalText(value: unknown, label: string, max = 1000): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') return `${label}格式不正确`
  if (value.length > max) return `${label}最多 ${max} 个字`
  return null
}

function textSteps(value: unknown, label: string, max = 10): string | null {
  if (value === undefined || value === null) return null
  if (!Array.isArray(value)) return `${label}格式不正确`
  if (value.length > max) return `${label}最多 ${max} 条`
  for (const step of value) {
    if (typeof step !== 'string' || step.trim().length === 0) {
      return `${label}里有空步骤，请填写或删除`
    }
    if (step.trim().length > 60) return `${label}里单条最多 60 个字`
  }
  return null
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
  { required = true }: { required?: boolean } = {},
): string | null {
  if (value === null || value === undefined || value === '') {
    return required ? `请选择${label}` : null
  }
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    return `${label}的取值不合法`
  }
  return null
}

function optionalNumber(
  value: unknown,
  label: string,
  min: number,
  max: number,
): string | null {
  if (value === null || value === undefined || value === '') return null
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return `${label}必须是数字`
  if (num < min || num > max) return `${label}应在 ${min} - ${max} 之间`
  return null
}

function enumArray<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
): string | null {
  if (value === undefined || value === null) return null
  if (!Array.isArray(value)) return `${label}格式不正确`
  for (const item of value) {
    if (!(allowed as readonly string[]).includes(item)) return `${label}里有不合法的选项`
  }
  return null
}

export function validateChildProfile(draft: Draft<ChildProfile>) {
  const errors: string[] = []
  const wishErr = optionalText(draft.focusWishId, '心愿标识', 100)
  if (wishErr) errors.push(wishErr)
  const nameErr = requiredText(draft.name, '孩子名字', 20)
  if (nameErr) errors.push(nameErr)
  if (draft.birthDate !== null && draft.birthDate !== undefined && draft.birthDate !== '') {
    if (!isDayKey(draft.birthDate)) errors.push('出生日期格式不正确')
  }
  const noteErr = optionalText(draft.note, '备注', 500)
  if (noteErr) errors.push(noteErr)
  return finish(errors)
}

export function validateDailyLog(draft: Draft<DailyLog>): ValidationResult {
  const errors: string[] = []
  if (!isDayKey(draft.date)) errors.push('记录日期格式不正确')
  for (const [key, label] of [
    ['sleepTime', '入睡时间'],
    ['wakeTime', '起床时间'],
  ] as const) {
    const value = draft[key]
    if (value !== null && value !== undefined && value !== '' && !isClockTime(value)) {
      errors.push(`${label}格式应为 HH:mm`)
    }
  }
  const enumFields: Array<[keyof DailyLog, readonly string[], string]> = [
    ['nightCongestion', ['none', 'mild', 'moderate', 'severe'], '夜间鼻塞'],
    ['nightCough', ['none', 'once', 'several', 'frequent'], '夜间咳嗽'],
    ['snoring', ['no', 'sometimes', 'often'], '打鼾或张口呼吸'],
    ['nightWaking', ['none', 'once', 'twice', 'three_plus'], '夜间醒来情况'],
    ['morningState', ['refreshed', 'ok', 'tired', 'very_tired'], '晨起精神状态'],
    ['daytimeSleepiness', ['none', 'slight', 'obvious', 'severe'], '白天困倦情况'],
  ]
  for (const [key, allowed, label] of enumFields) {
    const err = enumValue(draft[key], allowed as readonly string[], label, {
      required: false,
    })
    if (err) errors.push(err)
  }
  const noteErr = optionalText(draft.note, '备注', 500)
  if (noteErr) errors.push(noteErr)

  const filled = [
    draft.sleepTime,
    draft.wakeTime,
    draft.nightCongestion,
    draft.nightCough,
    draft.snoring,
    draft.nightWaking,
    draft.morningState,
    draft.daytimeSleepiness,
  ].some((v) => v !== null && v !== undefined && v !== '')
  if (!filled) errors.push('至少填写一项记录内容')
  return finish(errors)
}

export function validateTaskTemplate(draft: Draft<TaskTemplate>): ValidationResult {
  const errors: string[] = []
  const nameErr = requiredText(draft.name, '任务名称', 40)
  if (nameErr) errors.push(nameErr)
  const subjectErr = requiredText(draft.subject, '学科或任务领域', 20)
  if (subjectErr) errors.push(subjectErr)
  const diffErr = enumValue(draft.defaultDifficulty, DIFFICULTY, '任务难度')
  if (diffErr) errors.push(diffErr)
  const minutesErr = optionalNumber(draft.defaultMinutes, '建议时长（分钟）', 1, 180)
  if (minutesErr) errors.push(minutesErr)
  const stepsErr = textSteps(draft.steps, '任务步骤')
  if (stepsErr) errors.push(stepsErr)
  return finish(errors)
}

export function validateTaskRecord(draft: Draft<TaskRecord>): ValidationResult {
  const errors: string[] = []
  if (draft.rewardStars != null && ![1, 2].includes(draft.rewardStars)) errors.push('新打卡星数只能为1或2')
  const nameErr = requiredText(draft.name, '任务名称', 40)
  if (nameErr) errors.push(nameErr)
  const subjectErr = requiredText(draft.subject, '学科或任务领域', 20)
  if (subjectErr) errors.push(subjectErr)
  if (!isDayKey(draft.date)) errors.push('记录日期格式不正确')
  const diffErr = enumValue(draft.difficulty, DIFFICULTY, '任务难度')
  if (diffErr) errors.push(diffErr)
  const startErr = enumValue(draft.startMode, START_MODE, '启动情况', { required: false })
  if (startErr) errors.push(startErr)
  const doneErr = enumValue(draft.completion, COMPLETION, '完成状态', { required: false })
  if (doneErr) errors.push(doneErr)
  const barriersErr = enumArray(draft.barriers, BARRIERS, '主要障碍')
  if (barriersErr) errors.push(barriersErr)
  const plannedErr = optionalNumber(draft.plannedMinutes, '计划时长（分钟）', 1, 180)
  if (plannedErr) errors.push(plannedErr)
  const actualErr = optionalNumber(draft.actualMinutes, '实际用时（分钟）', 0, 600)
  if (actualErr) errors.push(actualErr)
  const noteErr = optionalText(draft.parentNote, '家长备注', 1000)
  if (noteErr) errors.push(noteErr)
  return finish(errors)
}

export function validateRoutineRule(draft: Draft<RoutineRule>): ValidationResult {
  const errors: string[] = []
  if (draft.habitKey != null && !HABIT_PLAN.some(h => h.key === draft.habitKey)) errors.push('打卡项目标识无效')
  if (draft.rewardStars != null && ![1, 2].includes(draft.rewardStars)) errors.push('图卡星数只能为1或2')
  if (draft.category != null && !['life', 'sport', 'study'].includes(draft.category)) errors.push('打卡分类无效')
  const minErr = optionalNumber(draft.minMinutes, '运动分钟数', 1, 600)
  if (minErr) errors.push(minErr)
  const titleErr = requiredText(draft.title, '规则名称', 40)
  if (titleErr) errors.push(titleErr)
  const triggerErr = enumValue(draft.trigger, RULE_TRIGGER, '触发时机')
  if (triggerErr) errors.push(triggerErr)
  if (draft.trigger === 'custom') {
    const customErr = requiredText(draft.customTrigger, '自定义触发时机', 30)
    if (customErr) errors.push(customErr)
  }
  const stepsErr = textSteps(draft.steps, '执行步骤')
  if (stepsErr) errors.push(stepsErr)
  return finish(errors)
}

export function validateRoutineCheck(draft: Draft<RoutineCheck>): ValidationResult {
  const errors: string[] = []
  if (!isDayKey(draft.date)) errors.push('记录日期格式不正确')
  for (const [value, label] of [[draft.childId, '儿童标识'], [draft.ruleId, '图卡标识']]) { const err = requiredText(value, String(label), 200); if (err) errors.push(err) }
  const status = enumValue(draft.status, RULE_STATUS, '执行情况')
  if (status) errors.push(status)
  if (draft.rewardStars != null && ![1, 2].includes(draft.rewardStars)) errors.push('新打卡星数只能为1或2')
  const minutes = optionalNumber(draft.minutes, '运动分钟数', 0, 600)
  if (minutes) errors.push(minutes)
  if (draft.studyLevel != null && !DIFFICULTY.includes(draft.studyLevel)) errors.push('学习难度无效')
  if (draft.studyWords != null && (!Array.isArray(draft.studyWords) || draft.studyWords.length > 8 || draft.studyWords.some(w => typeof w !== 'string' || !/^[a-z]{2,15}$/.test(w)) || new Set(draft.studyWords).size !== draft.studyWords.length)) errors.push('学习单词记录无效')
  const steps = textSteps(draft.stepsDone, '完成步骤')
  if (steps) errors.push(steps)
  return finish(errors)
}

export function validateConflictLog(draft: Draft<ConflictLog>): ValidationResult {
  const errors: string[] = []
  if (typeof draft.occurredAt !== 'string' || Number.isNaN(Date.parse(draft.occurredAt))) {
    errors.push('请填写有效的发生时间')
  }
  const triggerErr = enumValue(draft.trigger, CONFLICT_TRIGGER, '触发情境')
  if (triggerErr) errors.push(triggerErr)
  if (draft.trigger === 'other') {
    const otherErr = requiredText(draft.triggerOther, '其他情境说明', 40)
    if (otherErr) errors.push(otherErr)
  }
  for (const [key, label, max] of [
    ['childDescription', '孩子如何描述事情', 1000],
    ['parentResponse', '家长的处理方式', 1000],
    ['resolution', '最终如何解决', 1000],
    ['nextIdea', '下次可以尝试的方法', 1000],
  ] as const) {
    const err = requiredText(draft[key], label, max)
    if (err) errors.push(err)
  }
  const otherDescErr = optionalText(draft.otherDescription, '另一方如何描述事情', 1000)
  if (otherDescErr) errors.push(otherDescErr)
  const repairErr = enumValue(draft.repaired, REPAIR_STATE, '是否修复', { required: false })
  if (repairErr) errors.push(repairErr)
  return finish(errors)
}

export function validateStrengthMoment(draft: Draft<StrengthMoment>): ValidationResult {
  const errors: string[] = []
  if (!isDayKey(draft.date)) errors.push('记录日期格式不正确')
  const catErr = enumValue(draft.category, STRENGTH_CATEGORY, '优势类别')
  if (catErr) errors.push(catErr)
  if (draft.category === 'other' && !draft.categoryOther) {
    errors.push('请填写其他优势的说明')
  }
  for (const [key, label] of [
    ['event', '具体事件'],
    ['childAction', '孩子做了什么'],
    ['outcome', '结果如何'],
  ] as const) {
    const err = requiredText(draft[key], label, 500)
    if (err) errors.push(err)
  }
  const feelingErr = optionalText(draft.childFeeling, '孩子自己的感受', 300)
  if (feelingErr) errors.push(feelingErr)
  return finish(errors)
}

export function validateWeeklyReview(draft: Draft<WeeklyReview>): ValidationResult {
  const errors: string[] = []
  if (!isDayKey(draft.weekStart)) {
    errors.push('周起始日期格式不正确')
  } else if (dayKeyToDate(draft.weekStart).getDay() !== 1) {
    errors.push('一周的起点必须是周一')
  }
  for (const [key, label] of [
    ['improvements', '本周的改善'],
    ['difficulties', '仍然困难的情境'],
    ['effectiveSupport', '有效的支持方式'],
    ['conflictSources', '增加冲突的方法'],
    ['nextAdjustments', '下周准备调整的一两件事'],
  ] as const) {
    const err = optionalText(draft[key], label, 2000)
    if (err) errors.push(err)
  }
  return finish(errors)
}

export function validateExperiment(draft: Draft<Experiment>): ValidationResult {
  const errors: string[] = []
  for (const [key, label] of [
    ['problem', '问题'],
    ['hypothesis', '假设'],
    ['adjustment', '调整措施'],
  ] as const) {
    const err = requiredText(draft[key], label, 1000)
    if (err) errors.push(err)
  }
  if (!isDayKey(draft.startDate)) errors.push('开始日期格式不正确')
  if (!isDayKey(draft.endDate)) errors.push('结束日期格式不正确')
  if (isDayKey(draft.startDate) && isDayKey(draft.endDate)) {
    if (diffDays(draft.endDate, draft.startDate) < 0) {
      errors.push('结束日期不能早于开始日期')
    }
    if (diffDays(draft.endDate, draft.startDate) > 120) {
      errors.push('实验周期建议不超过 120 天')
    }
  }
  const metrics = draft.metrics
  if (!Array.isArray(metrics) || metrics.filter((m) => `${m}`.trim()).length === 0) {
    errors.push('至少填写一项观察指标')
  }
  const resultErr = enumValue(draft.result, EXPERIMENT_RESULT, '实验结果', {
    required: false,
  })
  if (resultErr) errors.push(resultErr)
  const noteErr = optionalText(draft.parentNote, '家长备注', 1000)
  if (noteErr) errors.push(noteErr)
  return finish(errors)
}

export function validateRuleStatus(value: unknown): ValidationResult {
  const err = enumValue(value, RULE_STATUS, '执行情况')
  return finish(err ? [err] : [])
}

export function validateBarriers(values: Barrier[]): ValidationResult {
  const err = enumArray(values, BARRIERS, '主要障碍')
  return finish(err ? [err] : [])
}

export function validatePin(pin: unknown): ValidationResult {
  if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
    return finish(['家长密码需要 4 位数字'])
  }
  return finish([])
}
